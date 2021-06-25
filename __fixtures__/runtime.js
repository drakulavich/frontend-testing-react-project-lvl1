/* eslint-disable no-shadow */
/* eslint-disable no-use-before-define */
/* eslint-disable no-undef */
const square = document.getElementById('square');
const clickMe = document.getElementById('clickMe'); // Keeping it unobstrusive
function doDemo() {
  const button = this;
  square.style.backgroundColor = '#fa4';
  button.setAttribute('disabled', 'true');
  setTimeout(clearDemo, 2000, button);
}

function clearDemo(button) {
  const square = document.getElementById('square');
  square.style.backgroundColor = 'transparent';
  button.removeAttribute('disabled');
}

clickMe.onclick = doDemo;
