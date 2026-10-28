(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let hour = 6, playing = false, last = null, directions = false;
  const jumps = [...document.querySelectorAll('[data-hour]')];
  function render() {
    const angle = (hour - 6) * Math.PI / 12;
    const x = 380 + 116 * Math.cos(angle), y = 185 - 116 * Math.sin(angle);
    $('observer').setAttribute('transform', `translate(${x} ${y}) rotate(${90 - angle * 180 / Math.PI})`);
    $('land').setAttribute('transform', `rotate(${-angle * 180 / Math.PI} 380 185)`);
    $('clouds').setAttribute('transform', `rotate(${-angle * 180 / Math.PI} 380 185)`);
    // Local north points toward the pole; east is tangent in the rotation direction.
    const radial = [Math.cos(angle), -Math.sin(angle)];
    const east = [-Math.sin(angle), -Math.cos(angle)];
    for (const [name, vector] of [['n',radial.map(v=>-v)],['s',radial],['e',east],['w',east.map(v=>-v)]]) {
      $('compass-'+name).setAttribute('transform', `translate(${x+44*vector[0]} ${y+44*vector[1]})`);
    }
    $('north-guide').setAttribute('d', `M380 185L${x} ${y}`);
    const daylight = hour >= 6 && hour <= 18;
    const progress = (hour - 6) / 12;
    // Quadratic path matches the visible dashed arc exactly; its altitude peaks at south.
    const sunX = 95 + 570 * progress;
    const sunY = 190 - 620 * progress * (1 - progress);
    $('sun').setAttribute('transform', `translate(${sunX} ${sunY})`);
    $('sun').style.display = daylight ? '' : 'none';
    const elevation = Math.max(0, Math.sin(angle));
    const twilight = Math.max(0, 1 - Math.min(Math.abs(hour - 6), Math.abs(hour - 18)) / 1.5);
    const mix = (a,b,t) => a.map((v,i)=> Math.round(v+(b[i]-v)*t));
    const top = daylight ? mix([119,152,185],[89,177,221],elevation) : mix([12,26,54],[119,152,185],twilight);
    const bottom = daylight ? mix([255,205,155],[209,238,246],elevation) : mix([32,51,77],[255,205,155],twilight);
    $('sky-top').setAttribute('stop-color', `rgb(${top})`);
    $('sky-bottom').setAttribute('stop-color', `rgb(${bottom})`);
    $('stars').style.opacity = daylight ? 0 : 1 - twilight;
    $('sky-clouds').style.opacity = daylight ? .28 : .04;
    $('sun-reflection').setAttribute('transform', `translate(${sunX} 0)`);
    $('sun-reflection').style.opacity = daylight ? .65 - elevation * .4 : 0;
    let phase, description, time;
    if (Math.abs(hour - 6) < .15) { phase='日の出'; description='東から太陽が見え始めます。'; time='日の出ごろ'; }
    else if (Math.abs(hour - 12) < .15) { phase='正午'; description='太陽が南の空で最も高くなります。'; time='正午ごろ'; }
    else if (Math.abs(hour - 18) < .15) { phase='日の入り'; description='西に太陽が沈んでいきます。'; time='日の入りごろ'; }
    else if (hour > 6 && hour < 12) { phase='朝'; description='地球が回るにつれて、太陽が高く見えます。'; time='日の出から正午へ'; }
    else if (hour > 12 && hour < 18) { phase='午後'; description='太陽は南から西へ、低くなっていきます。'; time='正午から日の入りへ'; }
    else { phase='夜'; description='太陽と反対の側にいるので、太陽は見えません。'; time=hour < 6 ? '夜から日の出へ' : '日の入りから夜へ'; }
    $('phase').textContent=phase; $('description').textContent=description; $('time-label').textContent=time;
    $('timeline').value=hour; $('timeline').setAttribute('aria-valuetext', time);
    $('sky-view').setAttribute('aria-label', `地上から南を向いて見た空。${description}`);
    jumps.forEach(button => {const active=Math.abs(hour-Number(button.dataset.hour))<.15; button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  }
  function setPlaying(value) { playing=value; last=null; $('play').textContent=playing?'Ⅱ 一時停止':'▶ 再生'; $('play').setAttribute('aria-pressed',String(playing)); }
  $('play').addEventListener('click',()=>setPlaying(!playing));
  $('directions-toggle').addEventListener('click',()=>{
    directions=!directions;
    $('directions-toggle').setAttribute('aria-pressed',String(directions));
    $('directions-toggle').textContent=directions?'方角を非表示':'方角を表示';
    $('compass').setAttribute('display',directions?'inline':'none');
    for(const id of ['sunrise-label','sunset-label']) $(id).setAttribute('display',directions?'none':'inline');
    $('earth-view').setAttribute('aria-label','北極の上空から見た地球。上から太陽の光が当たり、地球は反時計回りに自転する。'+(directions?'赤い観察者の北は北極に向かい、東は自転で進む向き。':''));
  });
  $('timeline').addEventListener('input',e=>{setPlaying(false);hour=Number(e.target.value);render();});
  jumps.forEach(button=>button.addEventListener('click',()=>{setPlaying(false);hour=Number(button.dataset.hour);render();}));
  const surface=$('drag-surface'), earth=$('earth-view');
  let dragPointer=null, previousAngle=null;
  function pointerAngle(event) {
    const matrix=earth.getScreenCTM();
    if(!matrix) return null;
    const point=earth.createSVGPoint();
    point.x=event.clientX; point.y=event.clientY;
    const local=point.matrixTransform(matrix.inverse());
    const dx=local.x-380, dy=185-local.y;
    // Near the pole the angle is unstable. Re-anchor after leaving this area.
    return Math.hypot(dx,dy)<24 ? null : Math.atan2(dy,dx);
  }
  surface.addEventListener('pointerdown',event=>{
    if(dragPointer!==null || !event.isPrimary || event.button!==0) return;
    dragPointer=event.pointerId;
    previousAngle=pointerAngle(event);
    setPlaying(false);
    surface.setPointerCapture(event.pointerId);
    surface.classList.add('dragging');
    event.preventDefault();
  });
  surface.addEventListener('pointermove',event=>{
    if(event.pointerId!==dragPointer) return;
    const next=pointerAngle(event);
    if(next!==null && previousAngle!==null){
      const delta=Math.atan2(Math.sin(next-previousAngle),Math.cos(next-previousAngle));
      hour=((hour+delta*12/Math.PI)%24+24)%24;
      render();
    }
    previousAngle=next;
  });
  function endDrag(event) {
    if(event.pointerId!==dragPointer) return;
    dragPointer=null; previousAngle=null;
    surface.classList.remove('dragging');
    if(surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);
  }
  for(const type of ['pointerup','pointercancel','lostpointercapture']) surface.addEventListener(type,endDrag);
  document.addEventListener('visibilitychange',()=>{last=null;});
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(entries=>{
      const {width,height}=entries[0].contentRect;
      if(!width || !height) return;
      const viewHeight=Math.max(255,height/width*760);
      $('sky-view').setAttribute('viewBox',`0 ${255-viewHeight} 760 ${viewHeight}`);
      $('sky-backdrop').setAttribute('y',255-viewHeight);
      $('sky-backdrop').setAttribute('height',viewHeight);
    }).observe($('sky-view'));
  }
  function frame(now) { if(playing && !document.hidden){if(last!==null){hour=(hour+Math.min(now-last,100)*.0006*Number($('speed').value))%24;render();}last=now;}requestAnimationFrame(frame); }
  render(); requestAnimationFrame(frame);
})();
