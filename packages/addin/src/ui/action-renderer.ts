import { actionDefinitions, type TransformAction } from "@bank-ai/contracts";

const actionIcons: Partial<Record<TransformAction, string>> = {
  rewrite: '<path d="m4 16 9.8-9.8a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Zm8.4-8.4 3 3M12 20h9" />',
  shorten: '<circle cx="6" cy="7" r="3" /><circle cx="6" cy="17" r="3" /><path d="m8.5 8.5 11 8.5M8.5 15.5 19.5 7" />',
  summary: '<path d="M5 5h14M5 9h14M5 13h9M5 17h11M5 21h7" />',
  formalize: '<path d="M6 3h9l4 4v14H6V3Z" /><path d="M15 3v5h4M9 13h7M9 17h5M9 9h2" />',
  grammar: '<path d="M5 4h9M9.5 4v12M6.5 10h6M15 16l2.2 2.2L21 13" />',
  translate: '<path d="M4 5h10M9 3v2c0 5-2 8-5 10M6 10c2 2 4 3 7 4M15 10l4 11M13.5 17h7" />',
  expand: '<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5M8 12h8M12 8v8" />',
  tone: '<path d="M4 6h16M7 12h10M10 18h4" /><circle cx="4" cy="6" r="1" /><circle cx="17" cy="12" r="1" /><circle cx="10" cy="18" r="1" />'
};

export interface RenderedActions {
  buttons: HTMLButtonElement[];
  optionSelects: Map<TransformAction, HTMLSelectElement>;
}

export function renderActions(container: HTMLElement): RenderedActions {
  container.replaceChildren();
  for (const definition of actionDefinitions) {
    if (definition.id === "tone") continue;
    const card = document.createElement(definition.option ? "div" : "button");
    card.className = `action-card${definition.option ? " action-card-option" : ""}`;
    if (card instanceof HTMLButtonElement) {
      card.type = "button";
      card.dataset.action = definition.id;
    }
    const icon = document.createElement("span");
    icon.className = "action-icon";
    icon.ariaHidden = "true";
    icon.innerHTML = `<svg viewBox="0 0 24 24">${actionIcons[definition.id] ?? '<path d="M12 4v16M4 12h16" />'}</svg>`;
    const copy = document.createElement("span");
    copy.className = "action-copy";
    const title = document.createElement("strong");
    title.textContent = definition.title;
    copy.append(title);

    if (definition.option) {
      const select = document.createElement("select");
      select.className = "action-select";
      select.dataset.actionOption = definition.id;
      select.ariaLabel = definition.option.ariaLabel;
      for (const choice of definition.option.choices) {
        const option = document.createElement("option");
        option.value = choice.value;
        option.textContent = choice.label;
        select.append(option);
      }
      copy.append(select);
    } else {
      const description = document.createElement("small");
      description.textContent = definition.description;
      copy.append(description);
    }

    const trigger = document.createElement(definition.option ? "button" : "span");
    trigger.className = definition.option ? "action-go" : "chevron";
    trigger.textContent = "›";
    if (trigger instanceof HTMLButtonElement) {
      trigger.type = "button";
      trigger.dataset.action = definition.id;
      trigger.ariaLabel = definition.title;
    } else trigger.ariaHidden = "true";
    card.append(icon, copy, trigger);
    container.append(card);
  }

  return {
    buttons: [...container.querySelectorAll<HTMLButtonElement>("[data-action]")],
    optionSelects: new Map(
      [...container.querySelectorAll<HTMLSelectElement>("[data-action-option]")].map((select) => [
        select.dataset.actionOption as TransformAction,
        select
      ])
    )
  };
}
