import { getMemeTemplateBlankUrl } from "@/lib/meme-agent";

export type ReactionIntensity = "low" | "medium" | "high";

export type ReactionCatalogEntry = {
  id: string;
  templateId: string;
  name: string;
  imageUrl: string;
  provider: "memegen";
  assetType: "image";
  captionStyle: "top";
  intensity: ReactionIntensity;
  popularity: number;
  emotionTags: string[];
  situationTags: string[];
  searchTerms: string[];
  helper: string;
};

type ReactionCatalogSeed = Omit<
  ReactionCatalogEntry,
  "id" | "imageUrl" | "provider" | "assetType" | "captionStyle"
>;

type SearchReactionCatalogOptions = {
  limit?: number;
  fallbackToPopular?: boolean;
};

type SearchReactionCatalogResult = {
  items: ReactionCatalogEntry[];
  fallback: boolean;
};

const reactionCatalogSeed: ReactionCatalogSeed[] = [
  {
    templateId: "harold",
    name: "Hide the Pain Harold",
    intensity: "medium",
    popularity: 5,
    emotionTags: ["forced smile", "suppressed pain", "deadpan", "inner suffering"],
    situationTags: ["adult mode", "professional mask", "pretending to be fine", "awkward meeting"],
    searchTerms: ["holding it together", "smile through pain", "corporate pain", "internal screaming"],
    helper: "Best when someone is visibly containing pain while trying to stay composed.",
  },
  {
    templateId: "facepalm",
    name: "Facepalm",
    intensity: "medium",
    popularity: 5,
    emotionTags: ["disbelief", "embarrassment", "frustration", "secondhand embarrassment"],
    situationTags: ["bad idea", "obvious mistake", "watching a mess", "avoidable failure"],
    searchTerms: ["you cannot be serious", "why would you do this", "painful to watch", "come on"],
    helper: "Strong fit for cringe, avoidable mistakes, and disbelief at someone's decision-making.",
  },
  {
    templateId: "fine",
    name: "This is Fine",
    intensity: "high",
    popularity: 5,
    emotionTags: ["panic", "doom", "resignation", "chaos"],
    situationTags: ["everything is burning", "crisis denial", "meltdown", "pretending normalcy"],
    searchTerms: ["nothing is under control", "ship is sinking", "catastrophe", "quiet collapse"],
    helper: "Use for chaos that is clearly escalating while everyone pretends the situation is manageable.",
  },
  {
    templateId: "drake",
    name: "Drakeposting",
    intensity: "medium",
    popularity: 5,
    emotionTags: ["rejection", "preference", "approval", "disapproval"],
    situationTags: ["this not that", "bad option vs good option", "swap priorities", "choose better"],
    searchTerms: ["instead of", "prefer this", "hard pass", "the right choice"],
    helper: "Great when the joke is built on rejecting one approach and clearly preferring another.",
  },
  {
    templateId: "rollsafe",
    name: "Roll Safe",
    intensity: "medium",
    popularity: 5,
    emotionTags: ["smug", "clever", "fake genius", "self-satisfied"],
    situationTags: ["bad logic", "rationalizing nonsense", "thinking you hacked it", "own-goal logic"],
    searchTerms: ["galaxy brain logic", "technically true", "smart but dumb", "loophole energy"],
    helper: "Best for smug logic that sounds clever for one second and falls apart immediately after.",
  },
  {
    templateId: "fry",
    name: "Futurama Fry",
    intensity: "medium",
    popularity: 5,
    emotionTags: ["suspicion", "uncertainty", "doubt", "confusion"],
    situationTags: ["not sure if", "mixed signals", "hard to tell", "ambiguous motives"],
    searchTerms: ["is this real", "can't tell", "genuine or fake", "skeptical"],
    helper: "Use when the joke lives in uncertainty, suspicion, or trying to interpret unclear behavior.",
  },
  {
    templateId: "keanu",
    name: "Conspiracy Keanu",
    intensity: "medium",
    popularity: 5,
    emotionTags: ["paranoia", "spiral", "unease", "existential doubt"],
    situationTags: ["what if", "suspicious pattern", "rabbit hole", "conspiracy energy"],
    searchTerms: ["wait a second", "hold on", "sudden realization", "what if all along"],
    helper: "Fits spirals, suspicious pattern recognition, and thoughts that feel one step from conspiracy.",
  },
  {
    templateId: "woman-cat",
    name: "Woman Yelling at a Cat",
    intensity: "high",
    popularity: 5,
    emotionTags: ["outrage", "chaos", "accusation", "melodrama"],
    situationTags: ["argument", "talking past each other", "internet fight", "messy discourse"],
    searchTerms: ["quote tweet fight", "public argument", "overreaction", "drama"],
    helper: "Ideal when two sides are loudly misaligned and the humor comes from pure argumentative chaos.",
  },
  {
    templateId: "michael-scott",
    name: "Michael Scott No God No",
    intensity: "high",
    popularity: 4,
    emotionTags: ["horror", "dread", "panic", "despair"],
    situationTags: ["worst possible update", "please no", "terrible news", "immediate rejection"],
    searchTerms: ["absolutely not", "this cannot be happening", "hard no", "nightmare scenario"],
    helper: "Use when the reaction is pure horror at the mere suggestion of something happening.",
  },
  {
    templateId: "red",
    name: "Oh, Is That What We're Going to Do Today?",
    intensity: "medium",
    popularity: 4,
    emotionTags: ["challenging", "provoked", "annoyed", "ready to fight"],
    situationTags: ["you started this", "escalation", "choosing violence", "picking a fight"],
    searchTerms: ["so we're doing this", "okay then", "you asked for it", "game on"],
    helper: "Strong for moments where someone casually opens the door to conflict or escalation.",
  },
  {
    templateId: "regret",
    name: "I Immediately Regret This Decision",
    intensity: "high",
    popularity: 4,
    emotionTags: ["regret", "panic", "self-own", "instant remorse"],
    situationTags: ["bad call", "sent too soon", "launched too early", "obvious mistake"],
    searchTerms: ["undo undo undo", "that was a mistake", "instant regret", "should not have done that"],
    helper: "Best when the humor is the speed of the regret, not a long thoughtful aftermath.",
  },
  {
    templateId: "wddth",
    name: "We Don't Do That Here",
    intensity: "medium",
    popularity: 4,
    emotionTags: ["disapproval", "boundary setting", "dismissal", "contained annoyance"],
    situationTags: ["wrong culture fit", "bad habit", "out of bounds", "not acceptable here"],
    searchTerms: ["not on this team", "we're not doing that", "wrong room", "take that elsewhere"],
    helper: "Use for clean, firm rejection of an idea, habit, or behavior that does not belong.",
  },
  {
    templateId: "touch",
    name: "Principal Skinner",
    intensity: "medium",
    popularity: 4,
    emotionTags: ["self-delusion", "denial", "obliviousness", "misread reality"],
    situationTags: ["out of touch", "blaming everyone else", "missing the point", "institutional denial"],
    searchTerms: ["am I wrong", "no it's the children", "leadership delusion", "refuses to learn"],
    helper: "Great for authority figures who refuse self-reflection and blame everyone else instead.",
  },
  {
    templateId: "stonks",
    name: "Stonks",
    intensity: "medium",
    popularity: 4,
    emotionTags: ["false confidence", "business brain", "absurd optimism", "delusional certainty"],
    situationTags: ["bad business logic", "line go up", "investor brain", "metrics theater"],
    searchTerms: ["growth at all costs", "financial nonsense", "slide deck logic", "spreadsheet confidence"],
    helper: "Use when the joke is pseudo-financial logic or a laughably simplistic business win.",
  },
  {
    templateId: "success",
    name: "Success Kid",
    intensity: "low",
    popularity: 4,
    emotionTags: ["small win", "satisfaction", "relief", "victory"],
    situationTags: ["narrow escape", "unexpected win", "finally worked", "tiny triumph"],
    searchTerms: ["lets go", "we're so back", "pulled it off", "got lucky"],
    helper: "Fits compact wins, especially when the success feels scrappy or slightly accidental.",
  },
  {
    templateId: "badchoice",
    name: "Milk Was a Bad Choice",
    intensity: "medium",
    popularity: 4,
    emotionTags: ["regret", "self-awareness", "bad judgment", "heat of the moment"],
    situationTags: ["chose poorly", "avoidable mistake", "obvious bad idea", "learned too late"],
    searchTerms: ["that was dumb", "never doing that again", "bad choice", "self-inflicted"],
    helper: "Strong for dead-simple regret when someone very obviously picked the wrong move.",
  },
  {
    templateId: "dodgson",
    name: "See? Nobody Cares",
    intensity: "low",
    popularity: 4,
    emotionTags: ["dismissive", "apathetic", "unmoved", "dry"],
    situationTags: ["nobody asked", "no one cares", "zero traction", "empty announcement"],
    searchTerms: ["this got no reaction", "flopped", "ignored", "not important"],
    helper: "Best when the humor comes from complete indifference to a dramatic or self-important claim.",
  },
  {
    templateId: "whatyear",
    name: "What Year Is It?",
    intensity: "medium",
    popularity: 4,
    emotionTags: ["confusion", "dated disbelief", "disorientation", "timewarp"],
    situationTags: ["outdated take", "late to the trend", "feels ancient", "years behind"],
    searchTerms: ["internet explorer energy", "where have you been", "stuck in the past", "late update"],
    helper: "Use when something feels comically late, outdated, or behind the current reality.",
  },
  {
    templateId: "yallgot",
    name: "Y'all Got Any More of Them",
    intensity: "medium",
    popularity: 4,
    emotionTags: ["desperate", "hungry", "fixated", "itchy"],
    situationTags: ["need more", "addiction", "chasing supply", "scraping for scraps"],
    searchTerms: ["give me more", "where can i get", "searching again", "fiending"],
    helper: "Strong fit when the joke is desperate demand for more of the same thing.",
  },
  {
    templateId: "wonka",
    name: "Condescending Wonka",
    intensity: "medium",
    popularity: 4,
    emotionTags: ["sarcastic", "condescending", "smug", "mocking"],
    situationTags: ["talk down to me", "patronizing advice", "fake expertise", "please tell me more"],
    searchTerms: ["oh really", "go on", "im sure that works", "please enlighten me"],
    helper: "Use for dry sarcasm aimed at someone being performatively confident or patronizing.",
  },
  {
    templateId: "philosoraptor",
    name: "Philosoraptor",
    intensity: "low",
    popularity: 4,
    emotionTags: ["pondering", "curious", "absurdly thoughtful", "speculative"],
    situationTags: ["shower thought", "overthinking", "philosophical joke", "strange logic"],
    searchTerms: ["what if", "deep thought", "thinking too hard", "wait does that mean"],
    helper: "Best when the joke is a slightly ridiculous thought experiment or overthinking spiral.",
  },
  {
    templateId: "captain",
    name: "I am the Captain Now",
    intensity: "medium",
    popularity: 4,
    emotionTags: ["assertive", "dominant", "takeover", "control"],
    situationTags: ["new owner", "ops takes over", "power shift", "who is in charge now"],
    searchTerms: ["i run this now", "seized control", "new boss", "taking the wheel"],
    helper: "Use for clear power shifts, takeovers, and moments where someone abruptly takes charge.",
  },
  {
    templateId: "morpheus",
    name: "Matrix Morpheus",
    intensity: "medium",
    popularity: 4,
    emotionTags: ["knowing", "provocative", "mind-bending", "serious"],
    situationTags: ["what if", "truth bomb", "hard question", "calling out reality"],
    searchTerms: ["what if i told you", "the real reason", "hidden truth", "wake up"],
    helper: "Good for leading with a provocative thought that reframes the whole situation.",
  },
  {
    templateId: "leo",
    name: "Leo Strutting",
    intensity: "medium",
    popularity: 4,
    emotionTags: ["swagger", "victory", "feeling yourself", "main character"],
    situationTags: ["walking away like a winner", "post-win confidence", "flawless exit", "big energy"],
    searchTerms: ["strutting", "untouchable", "walking in with confidence", "victory lap"],
    helper: "Best for victory-lap energy, swagger, and walking into a situation like you already won.",
  },
  {
    templateId: "spongebob",
    name: "Mocking Spongebob",
    intensity: "medium",
    popularity: 5,
    emotionTags: ["mocking", "petty", "annoyed", "dismissive"],
    situationTags: ["copying a bad take", "making fun of someone", "quote tweet mockery", "childish mimicry"],
    searchTerms: ["mocking tone", "me repeating you", "annoying voice", "sarcastic imitation"],
    helper: "Perfect for mocking a tone, repeating a weak argument, or imitating someone with contempt.",
  },
  {
    templateId: "kermit",
    name: "But That's None of My Business",
    intensity: "low",
    popularity: 4,
    emotionTags: ["petty", "observant", "side-eye", "gossipy"],
    situationTags: ["pointing something out", "subtweet", "quiet judgment", "not my problem"],
    searchTerms: ["im just saying", "sip tea", "none of my business", "not to be messy but"],
    helper: "Use for side-eye commentary where the punchline is detached, petty observation.",
  },
  {
    templateId: "kombucha",
    name: "Kombucha Girl",
    intensity: "medium",
    popularity: 4,
    emotionTags: ["conflicted", "mixed feelings", "hesitation", "reconsideration"],
    situationTags: ["maybe yes maybe no", "processing both sides", "walking it back", "uncertain take"],
    searchTerms: ["on the other hand", "wait actually", "mixed reaction", "complicated"],
    helper: "Best for split-second internal debates and complicated reactions that go both ways.",
  },
  {
    templateId: "khaby-lame",
    name: "Khaby Lame Shrug",
    intensity: "low",
    popularity: 4,
    emotionTags: ["obviousness", "simplicity", "light mockery", "calm superiority"],
    situationTags: ["needless complexity", "simple fix", "why make it hard", "overengineered problem"],
    searchTerms: ["just do this", "simple answer", "you made this too complex", "obvious solution"],
    helper: "Use when someone overcomplicates a problem with a very obvious simple answer.",
  },
  {
    templateId: "sadfrog",
    name: "Feels Bad Man",
    intensity: "medium",
    popularity: 4,
    emotionTags: ["sad", "defeated", "depressed", "resigned"],
    situationTags: ["quiet loss", "low morale", "bad outcome", "existential slump"],
    searchTerms: ["pain", "it is so over", "rough day", "feels bad"],
    helper: "Use for sad, low-energy reactions where the feeling is defeat rather than dramatic panic.",
  },
  {
    templateId: "waygd",
    name: "What Are Ya Gonna Do?",
    intensity: "low",
    popularity: 3,
    emotionTags: ["resigned", "shrug", "acceptance", "fatalistic"],
    situationTags: ["it is what it is", "nothing can be done", "inevitable mess", "accepted fate"],
    searchTerms: ["oh well", "what can you do", "guess this is life", "shrug it off"],
    helper: "Strong for weary acceptance when the joke is that the mess is already baked in.",
  },
  {
    templateId: "happening",
    name: "It's Happening",
    intensity: "high",
    popularity: 4,
    emotionTags: ["excitement", "panic", "anticipation", "alarm"],
    situationTags: ["thing finally starting", "launch moment", "all systems go", "escalation"],
    searchTerms: ["everyone stay calm", "its happening", "go time", "we're live"],
    helper: "Works for moments where something has finally started and everyone is spiking with energy.",
  },
  {
    templateId: "agnes",
    name: "Agnes Harkness Winking",
    intensity: "low",
    popularity: 3,
    emotionTags: ["mischief", "knowing", "cheeky", "impish"],
    situationTags: ["you know what you did", "playing innocent", "suggestive joke", "wink wink"],
    searchTerms: ["we all know", "not saying it directly", "cheeky little hint", "you get it"],
    helper: "Use for knowing little asides where the joke is implied rather than shouted.",
  },
  {
    templateId: "doge",
    name: "Doge",
    intensity: "low",
    popularity: 3,
    emotionTags: ["awe", "bemusement", "internet brain", "goofy admiration"],
    situationTags: ["old internet reaction", "wow moment", "goofy amazement", "ironic appreciation"],
    searchTerms: ["wow", "such", "very", "many reactions"],
    helper: "Use when the tone should feel goofy, old-internet, and intentionally unserious.",
  },
  {
    templateId: "saltbae",
    name: "Salt Bae",
    intensity: "medium",
    popularity: 3,
    emotionTags: ["extra", "flair", "showmanship", "performative confidence"],
    situationTags: ["adding too much", "dramatic finishing touch", "showing off", "unnecessary flourish"],
    searchTerms: ["sprinkling on top", "extra sauce", "doing the most", "stylized flex"],
    helper: "Best when someone adds an unnecessary but theatrical finishing touch with maximum flair.",
  },
  {
    templateId: "aint-got-time",
    name: "Sweet Brown",
    intensity: "medium",
    popularity: 3,
    emotionTags: ["impatience", "urgency", "fed up", "dismissal"],
    situationTags: ["no time for that", "too busy", "hard pass", "moving on"],
    searchTerms: ["aint nobody got time", "not today", "im busy", "skip all that"],
    helper: "Use when the reaction is immediate impatience or refusal to entertain the nonsense.",
  },
  {
    templateId: "ackbar",
    name: "It's A Trap!",
    intensity: "high",
    popularity: 4,
    emotionTags: ["alarm", "warning", "suspicion", "panic"],
    situationTags: ["obvious trap", "bad incentive", "danger disguised as opportunity", "dont click that"],
    searchTerms: ["trap", "scam", "bait", "this smells wrong"],
    helper: "Great for moments that look appealing on the surface but are obviously a trap underneath.",
  },
  {
    templateId: "gandalf",
    name: "Confused Gandalf",
    intensity: "low",
    popularity: 3,
    emotionTags: ["confusion", "bewilderment", "trying to parse nonsense", "older wisdom failing"],
    situationTags: ["what are you talking about", "nonsense explanation", "lost in the details", "bad briefing"],
    searchTerms: ["i dont understand", "huh", "say that again", "none of this makes sense"],
    helper: "Use when the reaction is trying to understand nonsense and getting nowhere.",
  },
  {
    templateId: "mordor",
    name: "One Does Not Simply Walk into Mordor",
    intensity: "medium",
    popularity: 4,
    emotionTags: ["seriousness", "warning", "caution", "difficulty"],
    situationTags: ["hard thing", "underestimated complexity", "not that easy", "serious undertaking"],
    searchTerms: ["it is not that simple", "hard mode", "massively harder than it sounds", "serious work"],
    helper: "Use when someone badly underestimates how hard a task or transition really is.",
  },
  {
    templateId: "crazypills",
    name: "I Feel Like I'm Taking Crazy Pills",
    intensity: "medium",
    popularity: 3,
    emotionTags: ["frustration", "disbelief", "isolation", "confusion"],
    situationTags: ["am i the only one", "everyone else seems wrong", "gaslit by reality", "losing patience"],
    searchTerms: ["am i crazy", "does nobody else see this", "taking crazy pills", "what is happening"],
    helper: "Best when the joke is being surrounded by people acting like nonsense is normal.",
  },
  {
    templateId: "afraid",
    name: "Afraid to Ask Andy",
    intensity: "low",
    popularity: 3,
    emotionTags: ["hesitant", "nervous curiosity", "embarrassment", "tentative"],
    situationTags: ["awkward question", "nobody wants to ask", "can i say this", "delicate topic"],
    searchTerms: ["afraid to ask", "dumb question", "real question though", "can someone explain"],
    helper: "Use for timid questions everyone is thinking but nobody wants to say out loud.",
  },
  {
    templateId: "kramer",
    name: "Kramer, What's Going On In There?",
    intensity: "medium",
    popularity: 3,
    emotionTags: ["alarm", "curiosity", "concern", "chaotic confusion"],
    situationTags: ["what is going on", "strange noise", "weird process", "hidden chaos"],
    searchTerms: ["explain yourself", "what are you doing in there", "suspicious activity", "what is happening back there"],
    helper: "Works when something offscreen is clearly chaotic and someone needs an explanation immediately.",
  },
  {
    templateId: "sohot",
    name: "So Hot Right Now",
    intensity: "low",
    popularity: 3,
    emotionTags: ["trendiness", "hype", "fashionable approval", "bandwagon energy"],
    situationTags: ["hot take of the moment", "everyone doing this", "current trend", "hype cycle"],
    searchTerms: ["in vogue", "trending", "everyone is into this", "hot right now"],
    helper: "Use for ideas, products, or opinions that are getting attention mainly because they are trendy.",
  },
];

const reactionCatalog = reactionCatalogSeed
  .map((seed) => ({
    ...seed,
    id: seed.templateId,
    imageUrl: getMemeTemplateBlankUrl(seed.templateId),
    provider: "memegen" as const,
    assetType: "image" as const,
    captionStyle: "top" as const,
  }))
  .sort((left, right) => right.popularity - left.popularity || left.name.localeCompare(right.name));

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function buildSearchableFields(entry: ReactionCatalogEntry) {
  return [
    entry.templateId,
    entry.name,
    ...entry.emotionTags,
    ...entry.situationTags,
    ...entry.searchTerms,
    entry.helper,
  ];
}

function scoreReactionCatalogEntry(
  entry: ReactionCatalogEntry,
  queryTokens: string[],
  normalizedQuery: string,
) {
  if (!normalizedQuery) {
    return entry.popularity;
  }

  const fields = buildSearchableFields(entry).map((value) => value.toLowerCase());
  const nameTokens = tokenize(entry.name);
  const emotionTokens = entry.emotionTags.flatMap((value) => tokenize(value));
  const situationTokens = entry.situationTags.flatMap((value) => tokenize(value));
  const searchTokens = entry.searchTerms.flatMap((value) => tokenize(value));
  const helperTokens = tokenize(entry.helper);
  const allTokens = new Set([
    entry.templateId.toLowerCase(),
    ...nameTokens,
    ...emotionTokens,
    ...situationTokens,
    ...searchTokens,
    ...helperTokens,
  ]);

  let score = entry.popularity;

  if (fields.some((field) => field.includes(normalizedQuery))) {
    score += 18;
  }

  for (const token of queryTokens) {
    if (entry.templateId.toLowerCase() === token) {
      score += 30;
    }

    if (nameTokens.includes(token)) {
      score += 18;
    }

    if (emotionTokens.includes(token)) {
      score += 16;
    }

    if (situationTokens.includes(token)) {
      score += 14;
    }

    if (searchTokens.includes(token)) {
      score += 12;
    }

    if (helperTokens.includes(token)) {
      score += 8;
    }

    if (Array.from(allTokens).some((entryToken) => entryToken.includes(token))) {
      score += 4;
    }
  }

  return score;
}

export function getReactionCatalog() {
  return reactionCatalog;
}

export function getReactionCatalogEntry(reactionId: string) {
  return reactionCatalog.find((entry) => entry.id === reactionId) ?? null;
}

export function sanitizeReactionCaption(value: string, maxLength = 96) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function buildReactionMemeImageUrl(reactionId: string, caption: string) {
  const url = new URL("http://localhost/api/reaction-image");
  url.searchParams.set("reactionId", reactionId);
  url.searchParams.set("caption", sanitizeReactionCaption(caption));
  return `${url.pathname}${url.search}`;
}

export function searchReactionCatalog(
  query: string,
  options?: SearchReactionCatalogOptions,
): SearchReactionCatalogResult {
  const normalizedQuery = query.replace(/\s+/g, " ").trim().toLowerCase();
  const queryTokens = tokenize(normalizedQuery);
  const limit = Math.max(1, Math.min(options?.limit ?? 24, reactionCatalog.length));

  if (!normalizedQuery) {
    return {
      items: reactionCatalog.slice(0, limit),
      fallback: false,
    };
  }

  const scoredItems = reactionCatalog
    .map((entry) => ({
      entry,
      score: scoreReactionCatalogEntry(entry, queryTokens, normalizedQuery),
    }))
    .sort((left, right) => right.score - left.score || left.entry.name.localeCompare(right.entry.name));

  const matchedItems = scoredItems
    .filter((item) => item.score > item.entry.popularity)
    .slice(0, limit)
    .map((item) => item.entry);

  if (matchedItems.length > 0 || options?.fallbackToPopular === false) {
    return {
      items: matchedItems,
      fallback: false,
    };
  }

  return {
    items: reactionCatalog.slice(0, limit),
    fallback: true,
  };
}
