document.addEventListener('DOMContentLoaded',()=>{
  const toggle=document.querySelector('.menu-toggle');
  const nav=document.querySelector('#primaryNav');
  if(toggle&&nav){
    const setOpen=(next)=>{
      toggle.setAttribute('aria-expanded',String(next));
      toggle.setAttribute('aria-label',next?'Close navigation menu':'Open navigation menu');
      nav.classList.toggle('open',next);
    };
    toggle.addEventListener('click',()=>setOpen(toggle.getAttribute('aria-expanded')!=='true'));
    nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setOpen(false)));
    document.addEventListener('keydown',(e)=>{if(e.key==='Escape')setOpen(false);});
  }
});
