import React from "react";
import BlurText from "./BlurText";

type Props = {
  text: string;
  top?: string;
};

const Title = (props: Props) => {
  return (
    <div className="w-full flex flex-col items-center justify-center">
      {/* <h1
        id={props.text.toLowerCase()}
        className={`font-bold text-5xl gradient-title text-center ${
          props.top ? props.top : ""
        }`}
      >
        {props.text}
      </h1> */}
      <BlurText
        text={props.text}
        animateBy="words"
        direction="top"
        className={`font-bold text-5xl text-center ${
          props.top ? props.top : ""
        }`}
      />
    </div>
  );
};

export default Title;
