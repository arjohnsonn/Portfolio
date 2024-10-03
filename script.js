import { isMobile } from "./isMobile.js";

var observer = new IntersectionObserver(
  function (entries) {
    entries.forEach(function (entry) {
      var el = entry.target;
      if (entry.isIntersecting) {
        el.classList.add("animate");
        return;
      }
    });
  },
  { threshold: 0.2 }
);

document.querySelectorAll(".animation").forEach(function (i) {
  if (i) {
    observer.observe(i);
  }
});

/*function updateColumns() {
  // handle landing page text resizing
  if (isMobile()) {
    document.getElementById("column-break").style = "";
  } else {
    document.getElementById("column-break").style = "display: none;";
  }
}

updateColumns();

addEventListener("resize", () => {
  updateColumns();
});*/

//

let elements = [
  document.getElementById("greet-text"), // landing
  document.getElementById("about-me"),
  document.getElementById("experience"),
  document.getElementById("projects"),
  document.getElementById("contact"),
];

let navBarButtonsUl = document.getElementById("navBarButtons");
let buttons = navBarButtonsUl.querySelectorAll("a");

function getVisibility(element) {
  var rect = element.getBoundingClientRect();
  var windowHeight =
    window.innerHeight || document.documentElement.clientHeight;

  // visible height of the element
  var visibleHeight =
    Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0);

  // percentage of the element that is visible
  var visiblePercentage = (visibleHeight / element.offsetHeight) * 100;

  // rounded to two decimal places
  var percent = Math.max(
    0,
    Math.min(50, Math.round(visiblePercentage * 100) / 100)
  );

  return percent / 100;
}

document.addEventListener("wheel", function () {
  let closestElement;

  elements.forEach((element) => {
    if (!closestElement) {
      closestElement = element;
    } else {
      if (getVisibility(element) > getVisibility(closestElement)) {
        closestElement = element;
      }
    }
  });

  if (!closestElement) return;

  buttons.forEach((button) => {
    button.classList.remove("active");
  });

  switch (closestElement.id) {
    case "greet-text":
      buttons[0].classList.add("active");
      break;
    case "about-me":
      buttons[1].classList.add("active");
      break;
    case "experience":
      buttons[2].classList.add("active");
      break;
    case "projects":
      buttons[3].classList.add("active");
      break;
    case "contact":
      buttons[4].classList.add("active");
      break;
  }
});
