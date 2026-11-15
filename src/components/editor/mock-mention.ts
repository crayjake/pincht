import { Mark } from "@tiptap/core"

// Presentation only: these are editable text highlights, not linked mentions.
export const MockMention = Mark.create({
  name: "mockMention",
  inclusive: false,
  addAttributes() {
    return {
      category: {
        default: null,
        parseHTML: element => element.getAttribute("data-category"),
        renderHTML: attributes => ({ "data-category": attributes.category }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-mock-mention]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", { ...HTMLAttributes, "data-mock-mention": "" }, 0]
  },
})
