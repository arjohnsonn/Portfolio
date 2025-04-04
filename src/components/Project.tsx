import React from "react";
import { badges } from "../lib/skills";
import { Github, ExternalLink } from "lucide-react";
import Link from "next/link";

type Props = {
  title: string;
  description: string;
  image: string;
  skills?: string[];
  github?: string;
  deferButtons?: boolean;
  redirect?: string;
};

const Project = (props: Props) => {
  return (
    <div className="relative bg-neutral-800/70 rounded-2xl w-[90vw] md:w-[25vw] h-auto flex flex-col py-3 items-center">
      <div className="absolute flex right-5 gap-x-2 top-5">
        {props.github && !props.deferButtons && (
          <Link href={props.github}>
            <Github className="text-slate-400 hover:text-white transition-colors duration-300 hover:scale-105 " />
          </Link>
        )}
        {props.redirect && !props.deferButtons && (
          <Link href={props.redirect}>
            <ExternalLink className="text-slate hover:text-slate-400 transition-colors duration-300 hover:scale-105" />
          </Link>
        )}
      </div>
      <h1 className="font-bold text-2xl text-center">{props.title}</h1>
      <div className="px-4 pt-4">
        <div className="w-full transform transition duration-300 hover:scale-102">
          <img src={props.image} className="w-full rounded-xl" />
        </div>
        <p className="font-md text-center text-sm pt-4">{props.description}</p>
      </div>
      <div className="flex pt-2 flex-wrap gap-1.5 px-2 justify-center items-center">
        {props.skills?.map((skill) => (
          <img
            key={skill}
            src={badges[skill as keyof typeof badges]}
            alt={`${skill}`}
            className="hover:scale-105 transition-transform duration-300"
          />
        )) ?? []}
      </div>
      <div className="flex flex-row gap-x-2 pt-2">
        {props.github && props.deferButtons && (
          <Link href={props.github}>
            <Github className="text-slate-400 hover:text-white transition-colors duration-300 hover:scale-105" />
          </Link>
        )}
        {props.redirect && props.deferButtons && (
          <Link href={props.redirect}>
            <ExternalLink className="text-slate hover:text-white transition-colors duration-300 hover:scale-105" />
          </Link>
        )}
      </div>
    </div>
  );
};

export default Project;
