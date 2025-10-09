import { Dock, DockIcon } from "@/components/magicui/dock";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { GENERAL, NAVBAR } from "@/lib/navbar";

export default function Navbar() {
  return (
    <div className="pointer-events-none fixed items-center justify-center pb-3 inset-x-0 bottom-0 z-30 mx-auto mb-4 flex origin-bottom h-full max-h-14">
      <div className="fixed bottom-0 inset-x-0 h-16 w-full bg-black to-transparent backdrop-blur-lg [-webkit-mask-image:linear-gradient(to_top,black,transparent)] dark:bg-black"></div>
      <Dock className="z-50 pointer-events-auto relative mx-auto flex min-h-full h-full items-center px-1 bg-black border border-white-500 transform-gpu">
        {Object.entries(GENERAL).map(([name, data]) => (
          <DockIcon key={data.href}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={data.href}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "size-12 hover:bg-white/20 group"
                  )}
                >
                  <data.Image
                    className={`size-4 text-white transition-colors duration-200 ${
                      data.hoverColor || "text-white"
                    }`}
                  />
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>{name}</p>
              </TooltipContent>
            </Tooltip>
          </DockIcon>
        ))}
        <Separator orientation="vertical" className="h-full" />
        {Object.entries(NAVBAR).map(([name, social]) => (
          <DockIcon key={name}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  target="_blank"
                  href={social.href}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "size-12 hover:bg-white/20 group"
                  )}
                >
                  <social.Image
                    className={`size-4 text-white transition-colors duration-200 ${social.hoverColor}`}
                  />
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>{name}</p>
              </TooltipContent>
            </Tooltip>
          </DockIcon>
        ))}
      </Dock>
    </div>
  );
}
