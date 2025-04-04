"use client";

import Canvas from "../components/Canvas";
import Title from "../components/Title";
import Experience from "../components/Experience";
import Project from "../components/Project";
import { badges } from ".././lib/skills";
import Link from "next/link";
import { MoveUp } from "lucide-react";

export default function Home() {
  return (
    <div className="text-white">
      <Canvas />
      <div className="w-full h-screen flex flex-col items-center justify-center">
        <h1 className="text-white font-md text-5xl md:text-6xl">
          Hi, I'm <span className="text-[#F96868] font-bold">Aiden</span>
        </h1>
        <div className="typewriter">
          <p className="typewriter-text font-light text-xl md:text-2xl">
            I'm a student, programmer, and game developer
          </p>
        </div>
      </div>
      {/* ABOUT */}
      {/* <Title text="About Me" /> */}
      <Title text="Experience" />
      <Experience
        title="Longhorn Developers"
        position="Project Lead Developer"
        date="January 2025 - Present"
        bullets={[
          "Led the development of Help Me Bevo, a browser extension project, aimed to boost student motivation",
          "Designed and implemented customizable features, such as volume, assignment types, and platforms",
          "Achieved over ~2,200 unique users and 80,000+ uses in a single school year ",
          "Integrated user feedback to refine features, improve functionality, and optimize the user experience",
        ]}
      />
      <Experience
        title="Popular Roblox Game"
        position="Owner & Programmer"
        date="January 2022 - Present"
        bullets={[
          "Achieved over 250,000 hours of playtime, 500,000 visits, & over 13,500 favorites",
          "Achieved a 99th percentile position for average session time and 99th percentile for payer conversion rate",
          "Managed a development team of approximately 10 developers",
          "Programmed frontend and backend features, security, UI/UX, and a discord bot to manage player's data externally",
          "Developed a platform-leading advanced anti-exploit system that detects exploiters who inject and run malicious scripts",
        ]}
      />
      <Title text="Skills" top="pt-24" />
      <div className="flex flex-wrap gap-1.5 justify-center items-center px-16 pt-3">
        {Object.entries(badges).map(([name, src]) => (
          <img key={name} src={src} alt={`${name}`} />
        ))}
      </div>
      <Title text="Projects" top="pt-24" />
      <div className="flex flex-col md:flex-row md:flex-wrap gap-3 justify-center items-center md:items-start py-4">
        <Project
          title="Roblox Game"
          description="Played by hundreds of thousands of players & recognized as one of the most realistic Roblox roleplay games with over 250,000 hours of playtime. Programmed with Luau, Roblox's version of Lua, on both frontend and backend. We are in the 99th percentile on the platform for average session time."
          image="/images/Image1.png"
          skills={["Roblox", "lua", "Luau"]}
        />
        <Project
          title="Help Me Bevo"
          description="A chrome extension to display the infamous 3rd down Bevo animation every time you submit an assignment on Canvas. This extension has thousands of active users a week and nearly over a thousand downloads!"
          image="/images/HMB1.png"
          github="https://github.com/Longhorn-Developers/Help-Me-Bevo"
          skills={[
            "TypeScript",
            "HTML5",
            "CSS3",
            "React",
            "Vite",
            "TailwindCSS",
          ]}
        />
        <Project
          title="Dogifier"
          description="A website & extension that uses AI to add dogs to user-inputed images."
          image="/images/Dogifier.png"
          github="https://github.com/arjohnsonn/dogifier-web"
          skills={[
            "TypeScript",
            "HTML5",
            "CSS3",
            "React",
            "Next",
            "Supabase",
            "TailwindCSS",
          ]}
        />
        <Project
          title="Wordle Remake"
          description="A simple Wordle remake in React Native. This was my first React Native project!"
          image="/images/WordleRN.png"
          github="https://github.com/arjohnsonn/wordle-react-native"
          skills={[
            "TypeScript",
            "HTML5",
            "CSS3",
            "React_Native",
            "Expo",
            "TailwindCSS",
          ]}
        />
        <Project
          title="Canvas Quiz Strikethrough"
          description="A chrome extension that allows you to strikethrough quizzes on Canvas."
          image="/images/CQS.png"
          github="https://github.com/arjohnsonn/canvas-quiz-strikethrough"
          deferGithub={true}
          skills={["JavaScript", "HTML5", "CSS3"]}
        />
      </div>
      <Title text="Contact Me" top="pt-24" />
      <div className="w-full flex flex-col items-center justify-center pb-20 pt-2">
        <p className="font-small text-lg">
          You can contact me by using the link buttons in the bottom navigation
          bar! You can also use my emails below to contact me:
        </p>
        <div className="flex flex-row gap-x-2 pt-3">
          <a href="https://mail.google.com/mail/?view=cm&to=arjohnsonn12@gmail.com">
            <img src="https://img.shields.io/badge/Personal-D14836?style=for-the-badge&logo=gmail&logoColor=white" />
          </a>
          <a href="https://mail.google.com/mail/?view=cm&to=arjohnson12@utexas.edu">
            <img src="https://img.shields.io/badge/University-fc7b03?style=for-the-badge&logo=gmail&logoColor=white" />
          </a>
        </div>
      </div>
      <div className="pt-20 pb-20 flex w-full items-center justify-center">
        <div className="flex flex-col items-center justify-center">
          <p className="inline text-xl text-center">
            Looks like you made it to the end, thanks for scrolling through!
          </p>
          <br />
          <Link href="/">
            <MoveUp className="bouncing size-12 text-blue-500 hover:bg-gray-700 rounded-full p-2 transition-colors duration-300" />
          </Link>
        </div>
      </div>
    </div>
  );
}
