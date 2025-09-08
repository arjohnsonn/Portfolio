"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const AboutMeImageCycler = () => {
  const aboutMeImages = [
    "/Images/about-me/Self.jpeg",
    "/Images/about-me/SelfTruck1.jpeg",
    "/Images/about-me/Truck1.jpeg",
  ];

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const changeImage = (newIndex: numpnpber) => {
    if (isTransitioning) return;

    setIsTransitioning(true);

    setTimeout(() => {
      setCurrentImageIndex(newIndex);
      setIsTransitioning(false);
    }, 300);
  };

  const nextImage = () => {
    const newIndex = (currentImageIndex + 1) % aboutMeImages.length;
    changeImage(newIndex);
  };

  const prevImage = () => {
    const newIndex =
      (currentImageIndex - 1 + aboutMeImages.length) % aboutMeImages.length;
    changeImage(newIndex);
  };

  return (
    <div className="flex-shrink-0 relative group">
      <div className="relative overflow-hidden rounded-xl w-64 h-84 md:w-86 md:h-96">
        <img
          src={aboutMeImages[currentImageIndex]}
          alt="Aiden Johnson"
          className={`w-full h-full object-cover shadow-lg transition-opacity duration-300 ease-in-out ${
            isTransitioning ? "opacity-0" : "opacity-100"
          }`}
        />
      </div>
      <button
        onClick={prevImage}
        className="absolute left-1 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-75 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={nextImage}
        className="absolute right-1 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-75 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
};

export default AboutMeImageCycler;
