export type PunchReaction = {
  emojis: string[];
  gifQuery: string;
  mood:
    | "ANIMAL_CHAOS"
    | "COSMIC_CHAOS"
    | "NUCLEAR_CHAOS"
    | "BETTING_DISASTER"
    | "SHOPPING_DISASTER"
    | "DIY_DISASTER"
    | "ABSURD_SHOCK";
};

const ANIMALS: Array<[RegExp, string, string]> = [
  [/pigeon/i, "🐦", "pigeon"],
  [/hamster/i, "🐹", "hamster"],
  [/lama|alpaga/i, "🦙", "llama"],
  [/poulpe|calamar/i, "🐙", "octopus"],
  [/canard/i, "🦆", "duck"],
  [/chèvre|chevre/i, "🐐", "goat"],
  [/hérisson|herisson/i, "🦔", "hedgehog"],
  [/escargot/i, "🐌", "snail"],
  [/manchot/i, "🐧", "penguin"],
  [/chien|chihuahua/i, "🐕", "chihuahua"],
];

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function reactionForPunchline(text: string, context = ""): PunchReaction {
  const source = text + " " + context;
  const emojis: string[] = [];
  let mood: PunchReaction["mood"] = "ABSURD_SHOCK";
  const query: string[] = [];

  const animal = ANIMALS.find(([re]) => re.test(source));
  if (animal) {
    emojis.push(animal[1], "🤣", "💀");
    query.push(animal[2], "chaos funny reaction");
    mood = "ANIMAL_CHAOS";
  }

  if (/Dior|Sephora|IKEA|boutique|soldes|carte bleue|code PIN|shopping/i.test(source)) {
    emojis.push("💳", "🛍️", "💸");
    query.unshift("shopping spree shocked funny reaction");
    mood = "SHOPPING_DISASTER";
  }

  if (/Leroy Merlin|Feu Vert|barbecue|remorque|bricolage|garage/i.test(source)) {
    emojis.push("🛒", "🔧", "💸");
    query.unshift("hardware store shopping funny reaction");
    mood = "DIY_DISASTER";
  }

  if (/nucl[eé]aire|radioactif|centrale|explos|lance-flammes/i.test(source)) {
    emojis.push("☢️", "🔥", "💀");
    query.unshift("explosion shocked funny reaction");
    mood = "NUCLEAR_CHAOS";
  }

  if (/cosmi|galact|interstell|orbite|Mars|NASA|satellite|fus[eé]e|quantique/i.test(source)) {
    emojis.push("🪐", "🚀", "🤯");
    query.unshift("space confused shocked funny reaction");
    if (mood === "ABSURD_SHOCK") mood = "COSMIC_CHAOS";
  }

  if (/pari|ticket|combin[eé]|cote|mise|value|bookmaker/i.test(source)) {
    emojis.push("🎰", "💸", "😭");
    if (!query.length) query.push("bad bet shocked funny reaction");
    if (mood === "ABSURD_SHOCK") mood = "BETTING_DISASTER";
  }

  if (/grille-pain|micro-ondes|aspirateur|radiateur|mixeur|frigo|bouilloire|agrafeuse|s[eè]che-cheveux|multiprise/i.test(source)) {
    emojis.push("⚡", "🤖", "💀");
    if (!query.length) query.push("appliance chaos shocked funny reaction");
  }

  if (/moonwalk|danse|tongs|patinoire/i.test(source)) {
    emojis.push("🕺", "🩴", "🧊");
    if (!query.length) query.push("awkward dance fail funny reaction");
  }

  if (!query.length) query.push("shocked laughing disbelief funny reaction");
  if (!emojis.length) emojis.push("🤯", "😂", "💀");

  return {
    emojis: unique(emojis).slice(0, 3),
    gifQuery: unique(query).slice(0, 2).join(" "),
    mood,
  };
}