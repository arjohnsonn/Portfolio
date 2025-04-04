import React from "react";

type Props = {
  title: string;
  position: string;
  date: string;
  bullets: string[];
};

const Experience = (props: Props) => {
  return (
    <div className="px-32 w-full">
      <h1 className="font-bold text-2xl">
        <span className="text-[#F96868]">•</span> {props.title}
      </h1>
      <h1 className="text-md font-bold italic">
        {props.position}
        <span className="font-light">
          {" "}
          {"//"} {props.date}
        </span>
      </h1>
      <div className="w-full pt-2 p-4 flex flex-col gap-y-2">
        {props.bullets.map((bullet, index) => (
          <div key={index}>
            <h1 className="text-md font-light">• {bullet}</h1>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Experience;
