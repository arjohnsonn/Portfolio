import React from "react";
import BlurText from "./BlurText";

type Props = {
  text: string;
  top?: string;
};

const Title = (props: Props) => {
  return (
    <div className="w-full flex flex-col items-center justify-center">
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
