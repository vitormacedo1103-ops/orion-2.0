// Clínica Essenza — demo fictícia Orionnex
(function(){
  const t=document.querySelector('.toggle'), m=document.getElementById('menu');
  if(t&&m){t.addEventListener('click',()=>{const o=m.classList.toggle('open');t.setAttribute('aria-expanded',String(o))});m.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>m.classList.remove('open')))}
  document.querySelectorAll('.faq-i').forEach(i=>{const b=i.querySelector('.faq-q'),p=i.querySelector('.faq-a');b.addEventListener('click',()=>{const open=i.classList.contains('open');document.querySelectorAll('.faq-i').forEach(o=>{o.classList.remove('open');o.querySelector('.faq-a').style.maxHeight=null});if(!open){i.classList.add('open');p.style.maxHeight=p.scrollHeight+'px'}})});
  const els=document.querySelectorAll('.reveal');
  if(!('IntersectionObserver' in window)){els.forEach(e=>e.classList.add('visible'))}else{const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target)}}),{threshold:.12});els.forEach(e=>io.observe(e))}
})();
