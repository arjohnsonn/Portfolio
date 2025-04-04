import React from "react";

type Props = {
  text: string;
  top?: string;
};

const Title = (props: Props) => {
  return (
    <div>
      <h1
        id={props.text.toLowerCase()}
        className={`font-bold text-5xl gradient-title text-center ${
          props.top ? props.top : ""
        }`}
      >
        {props.text}
      </h1>
    </div>
  );
};

export default Title;
