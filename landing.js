import { isMobile } from "./isMobile.js";

var canvas = document.getElementById("canvas"),
  ctx = canvas.getContext("2d");

const starSpeed = 30;
var stars = [],
  FPS = 60,
  x = 150, // quantity of stars
  mouse = {
    x: 0,
    y: 0,
  }; // mouse location

function initCanvas() {
  canvas.width = window.innerWidth * 2;
  canvas.height = window.innerHeight * 2;
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.scale(2, 2); // Reduced scale from 3 to 2

  stars = [];

  // insert stars array with star data
  for (var i = 0; i < x; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 1 + 1,
      vx: Math.floor(Math.random() * starSpeed),
      vy: Math.floor(Math.random() * starSpeed),
    });
  }
}

const greetText = document.getElementById("greet-text");
const typewriterText = document.getElementById("typewriter-text");

function updateText() {
  console.log(window.innerWidth);
  // handle landing page text resizing
  if (isMobile()) {
    greetText.textContent = toString(isMobile());
    typewriterText.style.fontSize = "3.5vw";
    greetText.style.fontSize = "2.5em";
    canvas.style =
      "position: absolute; z-index: -1; display: none; visibility: hidden;";
  } else {
    typewriterText.style.fontSize = "2vw";
    greetText.style.fontSize = "3em";
    canvas.style = "position: absolute; z-index: -1;";
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
  }
}

setTimeout(() => {
  // fixes the issue of the internal canvas resolution not being set correctly
  initCanvas();
  updateText();
  console.log(isMobile());
}, 1000);

let resizeTimeout;
addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    initCanvas();
    updateText();
  }, 100); // debounce
});

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // draw stars
  ctx.globalCompositeOperation = "source-over";
  for (var i = 0, x = stars.length; i < x; i++) {
    var s = stars[i];
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(s.x / 2, s.y / 2, s.radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "black";
    ctx.stroke();
  }

  ctx.beginPath();
  for (var i = 0, x = stars.length; i < x; i++) {
    var starI = stars[i];
    ctx.moveTo(starI.x / 2, starI.y / 2);
    if (distance(mouse, starI) < 350) ctx.lineTo(mouse.x / 2, mouse.y / 2);
    for (var j = 0, x = stars.length; j < x; j++) {
      var starII = stars[j];
      if (distance(starI, starII) < 150) {
        ctx.lineTo(starII.x / 2, starII.y / 2);
      }
    }
  }
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = "gray";
  ctx.stroke();

  // create vignette effect around mouse
  var gradient = ctx.createRadialGradient(
    mouse.x / 2,
    mouse.y / 2,
    50,
    mouse.x / 2,
    mouse.y / 2,
    350
  );
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 1)");

  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width / 2, canvas.height / 2);
}

function distance(point1, point2) {
  var xs = 0;
  var ys = 0;

  xs = point2.x - point1.x;
  xs = xs * xs;

  ys = point2.y - point1.y;
  ys = ys * ys;

  return Math.sqrt(xs + ys);
}

// update star locations
function update() {
  for (var i = 0, x = stars.length; i < x; i++) {
    var s = stars[i];
    s.x += s.vx / FPS;
    s.y += s.vy / FPS;

    if (s.x < 0 || s.x > canvas.width) s.vx = -s.vx;
    if (s.y < 0 || s.y > canvas.height) s.vy = -s.vy;
  }
}

document.body.addEventListener("mousemove", function (e) {
  mouse.x = e.clientX * 2;
  mouse.y = e.clientY * 2;
});

window.addEventListener("wheel", function () {
  var element = document.getElementById("greet-text");

  var rect = element.getBoundingClientRect();
  var windowHeight =
    window.innerHeight || document.documentElement.clientHeight;

  // visible height of the element
  var visibleHeight =
    Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0);

  // percentage of the element that is visible
  var visiblePercentage = (visibleHeight / element.offsetHeight) * 100;

  // percentage rounded to two decimal places
  var percent = Math.max(
    0,
    Math.min(50, Math.round(visiblePercentage * 100) / 100)
  );

  if (percent > 0) {
    canvas.classList.add("fade-in");
    canvas.classList.remove("fade-out");
  } else {
    canvas.classList.add("fade-out");
    canvas.classList.remove("fade-in");
  }
});

// initialize
function tick() {
  draw();
  update();
  requestAnimationFrame(tick);
}

tick();
