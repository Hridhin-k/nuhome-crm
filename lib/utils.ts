import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "label-caps",
            "label-md",
            "data-tabular",
            "display-lg",
            "headline-lg",
            "headline-md",
            "headline-sm",
            "subheading",
            "body-lg",
            "body-md",
            "body-sm",
          ],
        },
      ],
      shadow: [{ shadow: ["card"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
