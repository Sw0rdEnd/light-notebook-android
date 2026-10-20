const select=document.querySelector('#device'),frame=document.querySelector('#frame');
function resize(){const [width,height]=select.value.split(',').map(Number);frame.style.width=width+'px';frame.style.height=height+'px';localStorage.setItem('light-journal-preview-device',select.value);}
const previous=localStorage.getItem('light-journal-preview-device');if([...select.options].some(o=>o.value===previous))select.value=previous;
select.addEventListener('change',resize);resize();
