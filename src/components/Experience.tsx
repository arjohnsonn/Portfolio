import React from "react";
import BlurText from "./BlurText";
import FadeContent from "./FadeContent";

type Props = {
  title: string;
  position: string;
  date: string;
  bullets: string[];
};

const Experience = (props: Props) => {
  return (
    <div className="px-14 md:px-32 w-full pt-4">
      <BlurText
        text={props.title}
        animateBy="words"
        direction="left"
        className="font-bold text-2xl"
      />

      <div className="flex flex-row gap-x-1.5">
        <BlurText
          text={props.position}
          animateBy="entire"
          direction="left"
          className="font-md font-bold italic"
        />
        <BlurText
          text={"// " + props.date}
          animateBy="entire"
          direction="left"
          className="font-md font-light italic"
        />
      </div>

      <div className="w-full pt-2 p-4 flex flex-col gap-y-2">
        {props.bullets.map((bullet, index) => (
          <FadeContent
            key={index}
            blur={true}
            duration={1000}
            initialOpacity={0}
          >
            <h1 className="text-md font-light">• {bullet}</h1>
          </FadeContent>
        ))}
      </div>
    </div>
  );
};

export default Experience;
