import Experience from "@/components/Experience";
import {
  Github,
  Linkedin,
  HomeIcon,
  Briefcase,
  Hammer,
  Instagram,
} from "lucide-react";

export interface Icon {
  Image: any;
  href: string;
  hoverColor?: string; // New property for a gradient CSS class
}

export const GENERAL: Record<string, Icon> = {
  Home: {
    Image: HomeIcon,
    href: "/",
  },
  Experience: {
    Image: Briefcase,
    href: "#experience",
    hoverColor: "group-hover:text-sky-400",
  },
  Projects: {
    Image: Hammer,
    href: "#projects",
    hoverColor: "group-hover:text-violet-500",
  },
};

export const NAVBAR: Record<string, Icon> = {
  GitHub: {
    Image: Github,
    href: "https://github.com/arjohnsonn",
    hoverColor: "group-hover:text-slate-400",
  },
  LinkedIn: {
    Image: Linkedin,
    href: "https://www.linkedin.com/in/aidenrjohnson",
    hoverColor: "group-hover:text-blue-500",
  },
  Instagram: {
    Image: Instagram,
    href: "https://www.instagram.com/aidenn.johnson/",
    hoverColor: "group-hover:text-pink-500",
  },
};
