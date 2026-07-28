import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { MentionList, type MentionItem } from "./mention-list";
import type { SuggestionOptions } from "@tiptap/suggestion";

export function createMentionSuggestion(
  members: MentionItem[],
  activeRef: { current: boolean },
): Omit<SuggestionOptions<MentionItem>, "editor"> {
  return {
    items: ({ query }) =>
      members
        .filter((m) => m.label.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 8),
    render: () => {
      let component: ReactRenderer<{ onKeyDown: (props: { event: KeyboardEvent }) => boolean }>;
      let popup: TippyInstance[];

      return {
        onStart: (props) => {
          activeRef.current = true;
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });
          if (!props.clientRect) return;

          popup = tippy("body", {
            getReferenceClientRect: () => props.clientRect!()!,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "bottom-start",
          });
        },
        onUpdate(props) {
          component.updateProps(props);
          if (!props.clientRect) return;
          popup[0]?.setProps({ getReferenceClientRect: () => props.clientRect!()! });
        },
        onKeyDown(props) {
          if (props.event.key === "Escape") {
            popup[0]?.hide();
            return true;
          }
          return component.ref?.onKeyDown(props) ?? false;
        },
        onExit() {
          activeRef.current = false;
          popup[0]?.destroy();
          component.destroy();
        },
      };
    },
  };
}
