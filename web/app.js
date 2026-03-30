const modeGrid = document.getElementById("modeGrid");
const queryInput = document.getElementById("queryInput");
const searchBtn = document.getElementById("searchBtn");
const results = document.getElementById("results");
const hint = document.getElementById("hint");
const status = document.getElementById("status");
const suggestions = document.getElementById("suggestions");
const mayorCard = document.getElementById("mayorCard");
const bingoCard = document.getElementById("bingoCard");
const currentMayorLink = document.getElementById("currentMayor");
const currentBingoLink = document.getElementById("currentBingo");
const mayorPage = document.getElementById("mayorPage");
const bingoPage = document.getElementById("bingoPage");
const museumPage = document.getElementById("museumPage");

let mode = "item";
let suggestTimer = null;
const API_BASE = "https://api.hypixel.net/v2";
const cache = new Map();
const itemTierByName = new Map();
const itemDisplayByName = new Map();

const demoQueries = {
  item: [
    { q: "Ender Helmet", tier: "EPIC", fields: [{ label: "Tier", value: "EPIC" }, { label: "Categoría", value: "Armor" }] },
    { q: "Aspect of the End", tier: "RARE", fields: [{ label: "Tier", value: "RARE" }, { label: "Categoría", value: "Weapon" }] },
  ],
  collection: [
    { q: "Cobblestone", fields: [{ label: "Categoría", value: "MINING" }, { label: "Tiers", value: "7" }] },
    { q: "Carrot", fields: [{ label: "Categoría", value: "FARMING" }, { label: "Tiers", value: "9" }] },
  ],
  skill: [
    { q: "Mining", fields: [{ label: "Max Level", value: "60" }, { label: "Tipo", value: "Skill" }] },
    { q: "Taming", fields: [{ label: "Max Level", value: "60" }, { label: "Tipo", value: "Skill" }] },
  ],
};
let demoIndex = 0;
let demoChar = 0;
let demoTimer = null;
let demoPaused = false;
let demoResetting = false;
const demoArea = document.getElementById("demoArea");
const demoText = document.getElementById("demoText");
const demoResults = document.getElementById("demoResults");
let demoActive = true;

function now() {
  return Date.now();
}

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key, value, ttlMs) {
  cache.set(key, { value, expiresAt: now() + ttlMs });
}

const hints = {
  item: "Ejemplo: Wise Dragon Boots",
  collection: "Ejemplo: Cobblestone",
  skill: "Ejemplo: Mining",
};

function setMode(newMode) {
  mode = newMode;
  if (modeGrid) {
    [...modeGrid.querySelectorAll(".mode")].forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === newMode);
    });
  }
  if (hint) hint.textContent = hints[newMode] || "";
  if (queryInput) {
    queryInput.disabled = false;
    queryInput.placeholder = queryInput.disabled ? "No hace falta" : "Escribe el nombre o ID";
  }
  if (suggestions) suggestions.innerHTML = "";
  startDemoTyping();
}

if (modeGrid) {
  modeGrid.addEventListener("click", (event) => {
    const btn = event.target.closest(".mode");
    if (!btn) return;
    setMode(btn.dataset.mode);
  });
}

async function fetchJson(url) {
  status.textContent = "Consultando...";
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  status.textContent = "Listo";
  return { ok: res.ok, data };
}

function renderEmpty(message, isError = false) {
  const cls = isError ? "empty error" : "empty";
  if (results) {
    results.innerHTML = `<div class="${cls}">${message}</div>`;
  }
}

function renderCard(title, fields) {
  const fieldHtml = fields
    .map((f) => `<div><span class="badge">${f.label}</span> ${f.value}</div>`)
    .join("");
  return `
    <div class="result-card">
      <div class="result-title">${title}</div>
      ${fieldHtml}
    </div>
  `;
}

function rarityClass(tier) {
  if (!tier) return "";
  const t = String(tier).toLowerCase();
  if (t === "very special") return "rarity-very-special";
  return `rarity-${t.replace(/\s+/g, "-")}`;
}

function hasMinecraftFormatting(text) {
  return typeof text === "string" && text.includes("§");
}

function renderItemName(name, tier) {
  if (hasMinecraftFormatting(name)) {
    return minecraftToHtml(name);
  }
  const cls = rarityClass(tier);
  return cls ? `<span class="${cls}">${name}</span>` : name;
}

function renderItemCard(name, tier, fields, material, skin, color, museumSection = "") {
  const title = renderItemName(name, tier);
  const icon = material ? materialIconImg(material, skin, color) : "";
  const meta = fields
    .filter((f) => f.label !== "Tier" && f.label !== "ID")
    .filter((f) => f.label === "Categoría" || f.label === "Precio NPC")
    .map((f) => {
      if (f.label === "Precio NPC") {
        return `<div class="item-meta"><span class="badge">NPC</span> <span class="coin-num">${f.value}</span></div>`;
      }
      return `<div class="item-meta"><span class="badge">${f.label}</span> ${f.value}</div>`;
    })
    .join("");
  const stats = fields
    .filter((f) => !["Tier", "ID", "Categoría", "Precio NPC"].includes(f.label))
    .map((f) => `<div class="stat-chip"><span class="stat-label">${f.label}</span> <span class="stat-value"${f.style ? ` style="${f.style}"` : ""}>${f.value}</span></div>`)
    .join("");
  return `
    <div class="result-card">
      <div class="item-title-row">
        ${icon}
        <div class="result-title">${title}</div>
      </div>
      ${stats ? `<div class="stat-grid">${stats}</div>` : ""}
      ${museumSection}
      ${meta}
    </div>
  `;
}

function renderMuseumSection(match, setItems = null) {
  const museum = extractMuseumInfo(match, setItems);
  if (!museum) return "";
  return `
    <div class="museum-card">
      <div class="museum-title">Museum</div>
      <div class="museum-grid">
        <div class="museum-field">XP<span class="museum-value">${museum.xp}</span></div>
        <div class="museum-field">Categoría<span class="museum-value">${museum.category}</span></div>
      </div>
    </div>
  `;
}

function extractMuseumInfo(match, setItems = null) {
  if (Array.isArray(setItems) && setItems.length) {
    const setKey = getArmorSetMuseumKey(setItems);
    const setXpMap =
      match?.armor_set_donation_xp ??
      match?.museum_data?.armor_set_donation_xp ??
      match?.museum?.armor_set_donation_xp ??
      null;
    if (setKey && setXpMap && typeof setXpMap === "object" && setXpMap[setKey] != null) {
      const category =
        match?.museum_data?.category ??
        match?.museumData?.category ??
        match?.museum?.category ??
        match?.category ??
        setItems.find((item) => item?.category)?.category ??
        "N/A";
      return {
        xp: setXpMap[setKey],
        category,
      };
    }
  }

  const museum =
    match?.museum_data ??
    match?.museumData ??
    match?.museum ??
    null;
  if (!museum || typeof museum !== "object") return null;

  const xp =
    museum.donation_xp ??
    museum.donationXp ??
    museum.xp ??
    museum.museum_xp ??
    museum.experience_value ??
    museum.value_xp ??
    museum.experience ??
    museum.value ??
    null;

  const category =
    museum.category ??
    museum.type ??
    museum.item_type ??
    museum.donation_type ??
    match?.category ??
    null;

  if (xp == null && category == null) return null;
  return {
    xp: xp ?? "N/A",
    category: category ?? "N/A",
  };
}

function renderRelatedItems(match, items) {
  const setItems = findRelatedItems(match, items);
  if (!setItems.length) return "";
  const setSummary = renderSetSummary(setItems);
  const museumSection = renderMuseumSection(match, setItems);
  const cards = setItems
    .map((item) => {
        const icon = item.material ? materialIconImg(item.material, item.skin, item.color) : "";
      const title = renderItemName(item.name, item.tier);
      const active = item.name === match.name ? " data-active=\"1\"" : "";
      return `
        <button class="related-card"${active} data-related-item="${item.name}">
          ${icon}
          <div>
            <div class="related-card-name">${title}</div>
            <div class="related-card-meta">${item.category || "Item relacionado"}</div>
          </div>
        </button>
      `;
    })
    .join("");
  return `
    <div class="related-items">
      <div class="related-title">Relacionados</div>
      <div class="related-grid">${cards}</div>
      ${setSummary}
      ${museumSection}
    </div>
  `;
}

function findRelatedItems(match, items) {
  if (!match || !Array.isArray(items)) return [];
  const armorPieces = ["Helmet", "Chestplate", "Leggings", "Boots"];

  const setKeyFromId = getArmorSetGroupingKey(match);
  if (setKeyFromId) {
    const related = items
      .filter((item) => getArmorSetGroupingKey(item) === setKeyFromId)
      .sort((a, b) => getArmorPieceOrder(a) - getArmorPieceOrder(b));
    if (related.length >= 2) return related;
  }

  if (!match?.name) return [];
  const pattern = parseArmorNamePattern(match.name, armorPieces);
  if (!pattern) return [];
  return armorPieces
    .map((piece) => pattern.template(piece))
    .map((name) => items.find((item) => item?.name === name))
    .filter(Boolean);
}

function getArmorSetGroupingKey(item) {
  const rawId = String(item?.id || "").toUpperCase();
  if (!rawId) return "";
  const cleaned = rawId
    .replace(/(?:^|_)(HELMET|CHESTPLATE|LEGGINGS|BOOTS)(?:_|$)/, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return cleaned !== rawId ? cleaned : "";
}

function getArmorPieceOrder(item) {
  const rawId = String(item?.id || "").toUpperCase();
  if (/(?:^|_)HELMET(?:_|$)/.test(rawId)) return 0;
  if (/(?:^|_)CHESTPLATE(?:_|$)/.test(rawId)) return 1;
  if (/(?:^|_)LEGGINGS(?:_|$)/.test(rawId)) return 2;
  if (/(?:^|_)BOOTS(?:_|$)/.test(rawId)) return 3;

  const rawName = String(item?.name || "");
  if (/(^|\s)Helmet(\s|$)/i.test(rawName)) return 0;
  if (/(^|\s)Chestplate(\s|$)/i.test(rawName)) return 1;
  if (/(^|\s)Leggings(\s|$)/i.test(rawName)) return 2;
  if (/(^|\s)Boots(\s|$)/i.test(rawName)) return 3;
  return 99;
}

function parseArmorNamePattern(name, armorPieces) {
  const safePieces = armorPieces.join("|");
  const prefixMatch = name.match(new RegExp(`^(${safePieces})\\s+(.+)$`, "i"));
  if (prefixMatch) {
    const suffix = prefixMatch[2];
    return {
      displayBase: suffix,
      template: (targetPiece) => `${targetPiece} ${suffix}`,
    };
  }

  const infixMatch = name.match(new RegExp(`^(.+?)\\s+(${safePieces})(.*)$`, "i"));
  if (infixMatch) {
    const prefix = infixMatch[1];
    const tail = infixMatch[3] || "";
    return {
      displayBase: `${prefix}${tail}`.trim(),
      template: (targetPiece) => `${prefix} ${targetPiece}${tail}`.trim(),
    };
  }

  return null;
}

function getArmorSetDisplayName(item, relatedItems = []) {
  const namePattern = parseArmorNamePattern(item?.name || "", ["Helmet", "Chestplate", "Leggings", "Boots"]);
  if (namePattern?.displayBase) {
    return namePattern.displayBase.replace(/^of\s+/i, "").trim();
  }

  const setKey = getArmorSetGroupingKey(item);
  if (setKey) {
    return setKey
      .split("_")
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(" ");
  }

  const fallback = relatedItems.find((entry) => entry?.name)?.name || item?.name || "Armor";
  return fallback;
}

function renderSetSummary(items) {
  const totals = sumItemStats(items);
  const statEntries = extractStatFields(totals)
    .map((s) => `<div class="stat-chip"><span class="stat-label">${s.label}</span> <span class="stat-value"${s.style ? ` style="${s.style}"` : ""}>${s.value}</span></div>`)
    .join("");
  if (!statEntries) return "";
  return `
    <div class="set-summary">
      <div class="set-summary-title">Stats totales del set</div>
      <div class="stat-grid">${statEntries}</div>
    </div>
  `;
}

function sumItemStats(items) {
  const totals = {};
  for (const item of items) {
    const stats = item?.stats;
    if (!stats || typeof stats !== "object") continue;
    for (const [key, value] of Object.entries(stats)) {
      const num = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(num)) continue;
      totals[key] = (totals[key] || 0) + num;
    }
  }
  return totals;
}

function getArmorSetMuseumKey(items) {
  const armorSuffixes = ["_HELMET", "_CHESTPLATE", "_LEGGINGS", "_BOOTS"];
  for (const item of items) {
    const id = String(item?.id || "").toUpperCase();
    for (const suffix of armorSuffixes) {
      if (id.endsWith(suffix)) {
        return id.slice(0, -suffix.length);
      }
    }
  }
  return "";
}

function getArmorSetMuseumKeyFromItem(item) {
  return getArmorSetMuseumKey([item]);
}

function formatMuseumLabel(value) {
  return String(value || "N/A")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function getMuseumEntries(items) {
  const setSeen = new Set();
  const entries = [];

  for (const item of items) {
    const museum = extractMuseumInfo(item);
    const setKey = getArmorSetMuseumKeyFromItem(item);
    const setXpMap =
      item?.armor_set_donation_xp ??
      item?.museum_data?.armor_set_donation_xp ??
      item?.museum?.armor_set_donation_xp ??
      null;

    if (setKey && setXpMap && typeof setXpMap === "object" && setXpMap[setKey] != null) {
      if (setSeen.has(setKey)) continue;
      setSeen.add(setKey);
      const relatedItems = items.filter((entry) => getArmorSetGroupingKey(entry) === setKey);
      const displayBase = getArmorSetDisplayName(item, relatedItems);
      const iconItem = relatedItems.find((entry) => getArmorPieceOrder(entry) === 0) || item;
      entries.push({
        type: "set",
        name: `${displayBase} Set`,
        museumCategory: formatMuseumLabel(item?.museum_data?.category ?? item?.category ?? "Armor Set"),
        museumXp: setXpMap[setKey],
        tier: item.tier,
        material: iconItem.material,
        color: iconItem.color,
        skin: iconItem.skin,
        note: "Donacion del set completo",
        matchItemName: item.name,
      });
      continue;
    }

    if (!museum) continue;
    entries.push({
      type: "item",
      name: item.name,
      museumCategory: formatMuseumLabel(museum.category),
      museumXp: museum.xp,
      tier: item.tier,
        material: item.material,
        color: item.color,
        skin: item.skin,
      note: formatMuseumLabel(item.category),
      matchItemName: item.name,
    });
  }

  return entries.sort((a, b) => {
    if (a.museumCategory !== b.museumCategory) return a.museumCategory.localeCompare(b.museumCategory);
    return a.name.localeCompare(b.name);
  });
}

function renderMuseumBrowser(items) {
  const entries = getMuseumEntries(items);
  if (!entries.length) {
    return `<div class="empty error">No se encontraron entradas de Museum.</div>`;
  }

  const categories = ["Todas", ...new Set(entries.map((entry) => entry.museumCategory))];
  const chips = categories
    .map((category, index) => `<button class="museum-filter${index === 0 ? " active" : ""}" data-museum-filter="${category}">${category}</button>`)
    .join("");
  const cards = entries
    .map((entry) => renderMuseumCard(entry))
    .join("");

  return `
    <div class="museum-browser">
      <div class="museum-header">
        <div class="result-title">Museum</div>
        <div class="museum-subtitle">Explora las piezas aceptadas en el Museum por categoria. Los sets de armadura aparecen una sola vez y cuentan como donacion completa.</div>
      </div>
      <div class="museum-filters">${chips}</div>
      <div class="museum-items-grid" id="museumGrid">${cards}</div>
    </div>
  `;
}

function renderMuseumCard(entry) {
  const title = renderItemName(entry.name, entry.tier);
  const icon = entry.material ? materialIconImg(entry.material, entry.skin, entry.color) : "";
  return `
    <button class="museum-item-card" data-museum-category="${entry.museumCategory}" data-related-item="${entry.matchItemName}">
      <div class="museum-item-top">
        ${icon}
        <div class="museum-item-name">${title}</div>
      </div>
      <div class="museum-item-note">${entry.note}</div>
      <div class="museum-grid">
        <div class="museum-field">XP<span class="museum-value">${entry.museumXp}</span></div>
        <div class="museum-field">Categoría<span class="museum-value">${entry.museumCategory}</span></div>
      </div>
    </button>
  `;
}

function materialIconUrl(material) {
  const id = normalizeMaterialId(material);
  return `https://assets.mcasset.cloud/1.20.4/assets/minecraft/textures/item/${id}.png`;
}

function materialIconImg(material, skin, color) {
  const id = normalizeMaterialId(material);
  if ((id === "skull_item" || id === "skull") && skin) {
    const textureId = skinToTextureId(skin);
    if (textureId) {
      return `<img class="item-icon" src="https://mc-heads.net/head/${textureId}/32" onerror="this.onerror=null;this.removeAttribute('src');this.style.display='none';" />`;
    }
    return "";
  }
  const leatherColor = parseLeatherColor(id, color);
  if (leatherColor) {
    const primary = materialIconUrl(id);
    const fallback = `https://assets.mcasset.cloud/1.16.2/assets/minecraft/textures/items/${id}.png`;
    const overlayPrimary = materialIconUrl(`${id}_overlay`);
    const overlayFallback = `https://assets.mcasset.cloud/1.16.2/assets/minecraft/textures/items/${id}_overlay.png`;
    return `
      <span class="item-icon item-icon-leather" style="--leather-color:${leatherColor};">
        <span class="item-icon-tint"
          style="mask-image:url('${primary}');-webkit-mask-image:url('${primary}');"
          onerror="void(0)"></span>
        <img class="item-icon-overlay"
          src="${overlayPrimary}"
          onerror="if(this.dataset.fallback==='1'){this.onerror=null;this.removeAttribute('src');this.style.display='none';}else{this.dataset.fallback='1';this.src='${overlayFallback}';}" />
      </span>
    `;
  }
  const primary = materialIconUrl(id);
  const fallback = `https://assets.mcasset.cloud/1.16.2/assets/minecraft/textures/items/${id}.png`;
  return `<img class="item-icon" src="${primary}" onerror="if(this.dataset.fallback==='1'){this.onerror=null;this.removeAttribute('src');this.style.display='none';}else{this.dataset.fallback='1';this.src='${fallback}';}" />`;
}

function normalizeMaterialId(material) {
  const raw = String(material).toLowerCase();
  if (raw.startsWith("gold_")) {
    return raw.replace(/^gold_/, "golden_");
  }
  return raw;
}

function parseLeatherColor(materialId, color) {
  if (!/^leather_(helmet|chestplate|leggings|boots)$/.test(String(materialId || ""))) {
    return "";
  }
  if (!color) return "";
  if (Array.isArray(color) && color.length >= 3) {
    return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  }
  if (typeof color === "string") {
    const parts = color.split(",").map((part) => Number(part.trim()));
    if (parts.length >= 3 && parts.slice(0, 3).every((value) => Number.isFinite(value))) {
      return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
    }
  }
  if (typeof color === "object") {
    const values = [color.r, color.g, color.b].map((value) => Number(value));
    if (values.every((value) => Number.isFinite(value))) {
      return `rgb(${values[0]}, ${values[1]}, ${values[2]})`;
    }
  }
  return "";
}

function skinToTextureId(skin) {
  try {
    if (!skin) return "";
    const value = typeof skin === "string" ? skin : (skin.value || "");
    if (!value) return "";
    if (value.includes("textures.minecraft.net/texture/")) {
      return value.split("textures.minecraft.net/texture/")[1].split(/[?#]/)[0];
    }
    const decoded = JSON.parse(atob(value));
    const url = decoded?.textures?.SKIN?.url || "";
    if (!url) return "";
    return url.split("textures.minecraft.net/texture/")[1]?.split(/[?#]/)[0] || "";
  } catch {
    return "";
  }
}

function renderSkillCard(name, description, levels) {
  const levelCards = levels.length
    ? `<div class="levels-grid">${levels
        .map(
          (lvl) => `
            <div class="level-card" data-unlocks="${encodeURIComponent((lvl.unlocks || []).join("\n"))}" data-title="${encodeURIComponent(`Nivel ${lvl.level}`)}">
              <div class="level-title">Nivel ${lvl.level}</div>
              <div class="level-xp">XP nivel: ${lvl.xpRequired ?? "N/A"}</div>
              <div class="level-xp">XP total: ${lvl.totalXp ?? "N/A"}</div>
            </div>
          `
        )
        .join("")}</div>`
    : "";
  return `
    <div class="result-card">
      <div class="result-title">${name}</div>
      ${description ? `<div class="perk-desc">${description}</div>` : ""}
      ${levelCards || "<div class='empty'>Sin niveles disponibles.</div>"}
    </div>
  `;
}

function renderItemDetails(match) {
  if (!match) return "Item no encontrado.";
  const title = renderItemName(match.name || "Item", match.tier);
  const icon = match.material ? materialIconImg(match.material, match.skin, match.color) : "";
  const meta = [];
  if (match.category) meta.push(`<div class="item-meta"><span class="badge">Categoría</span> ${match.category}</div>`);
  if (match.npc_sell_price) meta.push(`<div class="item-meta"><span class="badge">NPC</span> <span class="coin-num">${match.npc_sell_price}</span></div>`);
  const stats = extractStatFields(match.stats)
    .map((s) => `<div class="stat-chip"><span class="stat-label">${s.label}</span> <span class="stat-value"${s.style ? ` style="${s.style}"` : ""}>${s.value}</span></div>`)
    .join("");
  return `
    <div class="result-card">
      <div class="item-title-row">
        ${icon}
        <div class="result-title">${title}</div>
      </div>
      ${stats ? `<div class="stat-grid">${stats}</div>` : ""}
      ${renderMuseumSection(match)}
      ${meta.join("")}
    </div>
  `;
}

function extractStatFields(stats) {
  if (!stats || typeof stats !== "object") return [];
  const order = ["damage", "strength", "crit_damage", "crit_chance", "attack_speed", "intelligence", "ferocity"];
  const entries = Object.entries(stats);
  const sorted = [
    ...order.map((k) => entries.find(([key]) => key === k)).filter(Boolean),
    ...entries.filter(([key]) => !order.includes(key)),
  ];
  return sorted.map(([key, value]) => {
    const label = statLabel(key);
    const val = formatStatValue(key, value);
    return { label, value: val.text, style: val.style };
  });
}

function statLabel(key) {
  const map = {
    damage: "Damage",
    strength: "Strength",
    crit_damage: "Crit Damage",
    crit_chance: "Crit Chance",
    attack_speed: "Attack Speed",
    intelligence: "Intelligence",
    ferocity: "Ferocity",
  };
  return map[key] || key.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatStatValue(key, value) {
  const num = typeof value === "number" ? value : Number(value);
  const sign = num > 0 ? "+" : "";
  const text = Number.isFinite(num) ? `${sign}${num}` : String(value);
  if (key === "damage") return { text, style: "color:#ff5555;font-weight:600;" };
  if (key === "intelligence" || key === "ferocity") return { text, style: "color:#55ff55;font-weight:600;" };
  return { text, style: "" };
}

function categoryImage(category) {
  const map = {
    FARMING: "#22d3ee",
    MINING: "#f97316",
    COMBAT: "#ef4444",
    FORAGING: "#22c55e",
    FISHING: "#38bdf8",
    RIFT: "#a855f7",
  };
  const color = map[category] || "#64748b";
  const label = category ? category[0] : "?";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="72" height="72">
      <rect width="72" height="72" rx="12" fill="${color}"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
        font-family="Space Grotesk, sans-serif" font-size="28" fill="#0b0f14">${label}</text>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function renderCollectionCard(name, category, tiers, tierLabel) {
  const iconSrc = categoryImage(category);
  const title = tierLabel ? `<span class="${rarityClass(tierLabel)}">${name}</span>` : name;
  const tierHtml = tiers.length
    ? `<div class="tiers-row">${tiers
        .map(
          (t) =>
            `<div class="tier-chip">
              <div class="tier-label">Tier ${t.tier}</div>
              <div class="tier-amount">${t.amountRequired}</div>
              ${renderUnlocks(t.unlocks || [])}
            </div>`
        )
        .join("")}</div>`
    : `<div class="empty">Sin tiers disponibles.</div>`;
  return `
    <div class="result-card">
      <div class="result-title">${title}</div>
      <div class="collection-meta">
        <div class="category-icon"><img src="${iconSrc}" alt="${category || "Categoria"}" /></div>
        <div>${category || "N/A"}</div>
      </div>
      ${tierHtml}
    </div>
  `;
}

function renderUnlocks(unlocks) {
  if (!unlocks.length) return "";
  const items = unlocks
    .map((u) => {
      const isXp = typeof u === "string" && u.toLowerCase().includes("skyblock xp");
      const text = String(u);
      const itemName = guessItemFromUnlock(text);
      if (isXp) {
        return `<div class="tier-unlock"><span class="xp">${text}</span></div>`;
      }
      if (itemName) {
        const tier = itemTierByName.get(itemName.toLowerCase());
        const cls = rarityClass(tier);
        const classes = ["tier-unlock", "unlock-item", cls].filter(Boolean).join(" ");
        return `<button class="${classes}" data-item="${itemName}">${text}</button>`;
      }
      return `<div class="tier-unlock">${text}</div>`;
    })
    .join("");
  return `<div class="tier-unlocks">${items}</div>`;
}

function renderUnlockLines(raw) {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines
    .map((line) => {
      const normalized = normalizeUnlockItemName(line);
      const key = normalized.toLowerCase();
      const itemName = itemDisplayByName.get(key);
      if (itemName) {
        const tier = itemTierByName.get(key);
        const cls = rarityClass(tier);
        const classes = ["unlock-item", cls].filter(Boolean).join(" ");
        return `<button class="${classes}" data-item="${itemName}">${line}</button>`;
      }
      return `<div>${minecraftToHtml(line)}</div>`;
    })
    .join("<br>");
}

function normalizeUnlockItemName(text) {
  let value = text.trim();
  const suffixes = [" Reforge", " Reforge Stone", " Reforge Stone Recipe"];
  for (const suf of suffixes) {
    if (value.toLowerCase().endsWith(suf.toLowerCase())) {
      value = value.slice(0, -suf.length).trim();
      break;
    }
  }
  return value;
}

function guessItemFromUnlock(text) {
  if (!text) return null;
  const lower = text.toLowerCase().trim();
  if (lower.endsWith(" recipes") && lower.includes(" minion recipes")) {
    const base = text.slice(0, -8).trim();
    const name = base.endsWith(" Minion") || base.endsWith(" minion") ? base : `${base} Minion`;
    return `${name} I`;
  }
  if (!lower.endsWith(" recipe")) return null;
  const name = text.slice(0, -7).trim();
  return name || null;
}

function renderSuggestions(items) {
  if (!items.length) {
    suggestions.innerHTML = "";
    return;
  }
  suggestions.innerHTML = items
    .map(
      (item) =>
        `<div class="suggestion" data-value="${item.value}">${item.value}<small>${item.type}</small></div>`
    )
    .join("");
}

async function loadSuggestions() {
  if (queryInput.disabled) return;
  const q = queryInput.value.trim();
  if (q.length < 2) {
    suggestions.innerHTML = "";
    return;
  }
  try {
    if (mode === "item") {
      const items = await loadItems();
      renderSuggestions(makeSuggestions(items, q, "Item"));
      return;
    }
    if (mode === "collection") {
      const collections = await loadCollections();
      renderSuggestions(makeSuggestions(collections, q, "Colección"));
      return;
    }
    if (mode === "skill") {
      const skills = await loadSkills();
      renderSuggestions(makeSuggestions(skills, q, "Skill"));
      return;
    }
    suggestions.innerHTML = "";
  } catch (err) {
    suggestions.innerHTML = "";
  }
}

function rankMatches(values, query, limit = 8) {
  const q = query.toLowerCase();
  const prefix = values.filter((v) => v.toLowerCase().startsWith(q));
  const contains = values.filter((v) => v.toLowerCase().includes(q) && !prefix.includes(v));
  return [...prefix, ...contains].slice(0, limit);
}

function makeSuggestions(list, query, type) {
  const names = list.map((i) => i.name).filter(Boolean);
  return rankMatches(names, query).map((name) => ({ value: name, type }));
}

function formatUnix(value) {
  if (!value && value !== 0) return "N/A";
  const num = Number(value);
  if (!Number.isFinite(num)) return "N/A";
  const date = new Date(num);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("es-ES");
}

function normalizePerk(perk, fallbackName = "Perk") {
  if (!perk) return null;
  if (typeof perk === "string") {
    return { name: fallbackName, description: perk, minister: false };
  }
  return {
    name: perk.name || fallbackName,
    description: perk.description || perk.desc || perk.lore || "Sin descripción",
    minister: perk.minister === true || perk.isMinister === true,
  };
}

function normalizePerkList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((perk, index) => normalizePerk(perk, `Perk ${index + 1}`)).filter(Boolean);
}

function resolveMayorData(data) {
  const mayorCandidates = [
    data?.mayor,
    data?.current?.mayor,
    data?.current,
  ].filter((entry) => entry && typeof entry === "object");

  const mayor =
    mayorCandidates.find((entry) => entry.name || Array.isArray(entry.perks) || entry.minister) || {};

  const electionCandidates = [
    data?.mayor?.election,
    data?.election,
    data?.current?.election,
    Array.isArray(data?.current?.candidates) ? data.current : null,
  ].filter((entry) => entry && typeof entry === "object");

  const election =
    electionCandidates.find((entry) => Array.isArray(entry.candidates) || entry.year != null) || {};

  const minister =
    mayor?.minister ||
    data?.minister ||
    data?.current?.minister ||
    {};

  return { mayor, election, minister };
}

function minecraftToHtml(text) {
  if (!text) return "";
  const map = {
    "0": "#000000",
    "1": "#0000AA",
    "2": "#00AA00",
    "3": "#00AAAA",
    "4": "#AA0000",
    "5": "#AA00AA",
    "6": "#FFAA00",
    "7": "#AAAAAA",
    "8": "#555555",
    "9": "#5555FF",
    "a": "#55FF55",
    "b": "#55FFFF",
    "c": "#FF5555",
    "d": "#FF55FF",
    "e": "#FFFF55",
    "f": "#FFFFFF",
  };
  let result = "";
  let color = "";
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "§" && i + 1 < text.length) {
      const code = text[i + 1].toLowerCase();
      if (map[code]) {
        color = map[code];
      }
      i += 1;
      continue;
    }
    if (color) {
      result += `<span style="color:${color}">${ch}</span>`;
    } else {
      result += ch;
    }
  }
  let styled = result;
  const formatPlusNumber = (num, cls) => {
    if (!num) return "";
    if (num.startsWith("+")) {
      const rest = num.slice(1);
      return `<span class="stat-plus"><span class="stat-sign">+</span><span class="${cls}">${rest}</span></span>`;
    }
    return `<span class="${cls}">${num}</span>`;
  };
  styled = styled.replace(/(\+?\d[\d,\.]*)(\s*x)?(\s*SkyBlock XP)/gi, (m, num, mult, label) => {
    const n = formatPlusNumber(num, "xp");
    const x = mult || "";
    return `${n}${x}<span class="xp">${label}</span>`;
  });
  styled = styled.replace(/(\+?\d[\d,\.]*)(\s*x)?(\s*Coins\b)/gi, (m, num, mult, label) => {
    const n = formatPlusNumber(num, "coin-num");
    const x = mult || "";
    return `${n}${x}${label}`;
  });
  styled = styled.replace(/^([A-Za-z ]+)\s([IVXLCDM]+)\b/g, (m, name, roman) => {
    return `<span class="stat-title">${name.trim()} ${roman}</span>`;
  });
  styled = styled.replace(/(\d[\d,\.]*)(\s*➜\s*)(\d[\d,\.]*%?)/g, (m, left, arrow, right) => {
    return `<span class="arrow-left">${left}${arrow}</span><span class="arrow-right">${right}</span>`;
  });
  styled = styled.replace(/☘\s*[A-Za-z ]*Fortune/gi, (m) => `<span class="stat-fortune">${m}</span>`);
  styled = styled.replace(/\+([A-Za-z])/g, (m, next) => {
    return `<span class="stat-sign">+</span>${next}`;
  });
  styled = styled.replace(/(\+?\d[\d,\.]*%?)(\s*[^\s]*\s*)?(Defense|Strength|Health|Crit Chance|Ability Damage|Intelligence|Pet Luck|Hunter Fortune)/gi, (match, num, symbol, stat) => {
    const plus = num.startsWith("+");
    const numHtml = (() => {
      if (!num) return "";
      if (num.startsWith("+")) {
        const rest = num.slice(1);
        return `<span class="stat-plus"><span class="stat-sign">+</span><span class="stat-num">${rest}</span></span>`;
      }
      return `<span class="stat-plus"><span class="stat-num">${num}</span></span>`;
    })();
    let cls = "";
    const key = stat.toLowerCase();
    if (key === "crit chance") cls = "stat-crit";
    else if (key === "health") cls = "stat-health";
    else if (key === "defense") cls = "stat-defense";
    else if (key === "strength") cls = "stat-strength";
    else if (key === "ability damage") cls = "stat-ability";
    else if (key === "intelligence") cls = "stat-intel";
    else if (key === "pet luck") cls = "stat-petluck";
    else if (key === "hunter fortune") cls = "stat-hunter";
    const sym = symbol || " ";
    return `${numHtml}<span class="${cls}">${sym}${stat}</span>`;
  });
  return styled;
}

async function loadItems() {
  const cached = getCache("items");
  if (cached) return cached;
  const { ok, data } = await fetchJson(`${API_BASE}/resources/skyblock/items`);
  if (!ok) throw new Error("items");
  const items = data.items || [];
  itemTierByName.clear();
  itemDisplayByName.clear();
  items.forEach((item) => {
    if (item?.name && item?.tier) {
      itemTierByName.set(String(item.name).toLowerCase(), item.tier);
      itemDisplayByName.set(String(item.name).toLowerCase(), item.name);
    }
  });
  setCache("items", items, 6 * 60 * 60 * 1000);
  return items;
}

async function loadCollections() {
  const cached = getCache("collections");
  if (cached) return cached;
  const { ok, data } = await fetchJson(`${API_BASE}/resources/skyblock/collections`);
  if (!ok) throw new Error("collections");
  const collections = [];
  const raw = data.collections || {};
  Object.entries(raw).forEach(([category, entries]) => {
    Object.values(entries.items || {}).forEach((info) => {
      collections.push({ ...info, _category: category });
    });
  });
  setCache("collections", collections, 6 * 60 * 60 * 1000);
  return collections;
}

async function loadSkills() {
  const cached = getCache("skills");
  if (cached) return cached;
  const { ok, data } = await fetchJson(`${API_BASE}/resources/skyblock/skills`);
  if (!ok) throw new Error("skills");
  const skills = Object.values(data.skills || {});
  setCache("skills", skills, 6 * 60 * 60 * 1000);
  return skills;
}

function pickMatch(list, query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  let exact = null;
  const partials = [];
  for (const item of list) {
    const name = String(item.name || "").toLowerCase();
    const id = String(item.id || "").toLowerCase();
    if (q === name || q === id) {
      exact = item;
      break;
    }
    if (q.includes(name) || name.includes(q) || id.includes(q)) {
      partials.push(item);
    }
  }
  return exact || partials[0] || null;
}

async function runSearch() {
  if (searchBtn) {
    searchBtn.classList.remove("searching");
    void searchBtn.offsetWidth;
    searchBtn.classList.add("searching");
  }
  const q = queryInput.value.trim();
  if ((mode === "item" || mode === "collection" || mode === "skill") && !q) {
    renderEmpty("Escribe algo para buscar.");
    return;
  }

  try {
    if (mode === "item") {
      const items = await loadItems();
      const match = pickMatch(items, q);
      if (!match) {
        renderEmpty("Item no encontrado.", true);
        return;
      }
      const fields = [];
      if (match.tier) fields.push({ label: "Tier", value: match.tier });
      if (match.category) fields.push({ label: "Categoría", value: match.category });
      if (match.npc_sell_price) fields.push({ label: "Precio NPC", value: match.npc_sell_price });
      if (match.id) fields.push({ label: "ID", value: match.id });
      fields.push(...extractStatFields(match.stats));
      const relatedSection = renderRelatedItems(match, items);
      results.innerHTML =
        renderItemCard(
          match.name || "Item",
          match.tier,
          fields,
          match.material,
          match.skin,
          match.color,
          relatedSection ? "" : renderMuseumSection(match)
        ) +
        relatedSection;
      return;
    }

    if (mode === "collection") {
      await loadItems();
      const collections = await loadCollections();
      const match = pickMatch(collections, q);
      if (!match) {
        renderEmpty("Colección no encontrada.", true);
        return;
      }
      const tiers = (match.tiers || [])
        .map((t) => ({
          tier: t.tier ?? "N/A",
          amountRequired: t.amountRequired ?? "N/A",
          unlocks: t.unlocks || [],
        }))
        .filter((t) => t.amountRequired !== "N/A");
      results.innerHTML = renderCollectionCard(
        match.name || "Colección",
        match._category || "N/A",
        tiers,
        match.tier
      );
      return;
    }

    if (mode === "skill") {
      const skills = await loadSkills();
      const match = pickMatch(skills, q);
      if (!match) {
        renderEmpty("Skill no encontrada.", true);
        return;
      }
      const levelsRaw = Array.isArray(match.levels) ? match.levels : [];
      const totals = levelsRaw.map((lvl) =>
        lvl.totalExpRequired ?? lvl.totalExperience ?? lvl.totalExp ?? lvl.totalXp ?? lvl.xp ?? lvl.experience ?? 0
      );
      const levels = levelsRaw.map((lvl, idx) => {
        const total = totals[idx] ?? 0;
        const prev = idx > 0 ? (totals[idx - 1] ?? 0) : 0;
        const xpThisLevel = total && prev ? total - prev : total || "N/A";
        return {
          level: lvl.level ?? lvl.lvl ?? idx + 1,
          xpRequired: xpThisLevel,
          totalXp: total || "N/A",
          unlocks: lvl.unlocks || lvl.rewards || [],
        };
      });
      results.innerHTML = renderSkillCard(match.name || "Skill", match.description || "", levels);
      return;
    }

  } catch (err) {
    renderEmpty("Error consultando la API.", true);
  }
}

if (searchBtn) searchBtn.addEventListener("click", () => {
  if (demoArea) {
    demoActive = false;
    demoArea.style.display = "none";
  }
  runSearch();
});
  if (queryInput) {
    queryInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") runSearch();
    });
    queryInput.addEventListener("input", () => {
      clearTimeout(suggestTimer);
      suggestTimer = setTimeout(loadSuggestions, 250);
      if (queryInput.value && demoArea) {
        demoActive = false;
        demoArea.style.display = "none";
      }
    });
    queryInput.addEventListener("focus", () => {
      demoPaused = true;
      if (demoArea) demoArea.classList.add("paused");
    });
    queryInput.addEventListener("blur", () => {
      demoPaused = false;
      if (demoArea) demoArea.classList.remove("paused");
    });
  }

if (results) {
  results.addEventListener("click", async (event) => {
    const related = event.target.closest("[data-related-item]");
    if (related && queryInput) {
      const item = related.dataset.relatedItem || "";
      if (item) {
        queryInput.value = item;
        runSearch();
      }
      return;
    }

    const btn = event.target.closest(".unlock-item");
    if (!btn || !goalModal || !modalTitle || !modalBody) return;
    const item = btn.dataset.item || "";
    if (!item) return;
    await loadItems();
    const match = pickMatch(await loadItems(), item);
    modalTitle.textContent = item;
    modalBody.innerHTML = renderItemDetails(match);
    goalModal.classList.add("active");
  });
}

if (museumPage) {
  museumPage.addEventListener("click", (event) => {
    const filter = event.target.closest("[data-museum-filter]");
    if (filter) {
      const value = filter.dataset.museumFilter || "Todas";
      museumPage.querySelectorAll("[data-museum-filter]").forEach((node) => {
        node.classList.toggle("active", node === filter);
      });
      museumPage.querySelectorAll("[data-museum-category]").forEach((card) => {
        const visible = value === "Todas" || card.dataset.museumCategory === value;
        card.style.display = visible ? "" : "none";
      });
      return;
    }

    const card = event.target.closest("[data-related-item]");
    if (card) {
      const item = card.dataset.relatedItem || "";
      if (item) {
        window.location.href = `./index.html?q=${encodeURIComponent(item)}&mode=item`;
      }
    }
  });
}

if (suggestions) {
  suggestions.addEventListener("click", (event) => {
    const item = event.target.closest(".suggestion");
    if (!item || !queryInput) return;
    queryInput.value = item.dataset.value || "";
    suggestions.innerHTML = "";
    runSearch();
  });
}

if (modeGrid) setMode(mode);

async function loadStaticPanels() {
  if (museumPage) {
    try {
      const items = await loadItems();
      museumPage.innerHTML = renderMuseumBrowser(items);
    } catch (err) {
      museumPage.innerHTML = `<div class="empty error">No se pudo cargar Museum.</div>`;
    }
  }

  try {
    const mayorRes = await fetchJson(`${API_BASE}/resources/skyblock/election`);
    if (mayorRes.ok) {
      const data = mayorRes.data;
      const { mayor, election, minister } = resolveMayorData(data);
      const mayorPerks = normalizePerkList(mayor.perks);
      const perks = mayorPerks.map((p) => p.name).join(", ");
      if (currentMayorLink) {
        currentMayorLink.textContent = `Current Mayor: ${mayor.name || "N/A"}`;
      }
      if (mayorCard) {
        mayorCard.innerHTML = renderCard(mayor.name || "Mayor", [
          { label: "Perks", value: perks || "N/A" },
          { label: "Actualizado", value: formatUnix(data.lastUpdated) },
        ]);
      }
      if (mayorPage) {
        const perkList = mayorPerks
          .map(
            (p) => `
                <div class="perk-item">
                  <div class="perk-title">${p.name || "Perk"}</div>
                  <div class="perk-desc">${minecraftToHtml(p.description || "Sin descripción")}</div>
                </div>
              `
          )
          .join("");
        const mayorYear = mayor?.election?.year || election.year || data.year || "N/A";
        const candidates = (election.candidates || []).slice().sort((a, b) => (b.votes || 0) - (a.votes || 0));
        const totalVotes = candidates.reduce((sum, c) => sum + (c.votes || 0), 0);
        const candidateCards = candidates.length
          ? candidates
              .map((c) => {
                const pct = totalVotes ? ((c.votes || 0) / totalVotes) * 100 : 0;
                const votesLabel = totalVotes
                  ? `${c.votes || 0}/${totalVotes} ${pct.toFixed(1)}%`
                  : "N/A";
                const cPerks = normalizePerkList(c.perks)
                  .map((p) => {
                    const name = p.name || "Perk";
                    const desc = minecraftToHtml(p.description || "");
                    const isMinister = p.minister === true;
                    return `
                      <div class="perk-item${isMinister ? " minister" : ""}">
                        <div class="perk-title">${name}</div>
                        <div class="perk-desc">${desc}</div>
                      </div>
                    `;
                  })
                  .join("");
                return `
                  <div class="result-card">
                    <div class="result-title">${c.name || "Candidato"} <span class="badge">${votesLabel}</span></div>
                    <div class="perk-list">${cPerks || "<div class='empty'>Sin perks</div>"}</div>
                  </div>
                `;
              })
                .join("")
            : `<div class="empty">${mayor.name ? `No hay votación activa durante ${mayor.name}.` : "Sin datos de votación actuales."}</div>`;
        const ministerPerk = normalizePerk(minister?.perk, "Minister Perk");
        mayorPage.innerHTML = `
            <div class="mayor-layout">
              <div class="mayor-column">
                <div class="result-card">
                  <div class="result-title">Gabinete Actual</div>
                  <div class="cabinet-title">Mayor</div>
                  <div class="result-title">${mayor.name || "Mayor"} <span class="badge">Año: ${mayorYear}</span></div>
                  <div class="perk-list">${perkList || "<div class='empty'>Sin perks</div>"}</div>
                  <div class="cabinet-title">Minister</div>
                  <div class="minister-name">${minister.name || "N/A"}</div>
                  <div class="perk-list">
                    ${
                      ministerPerk
                        ? `<div class="perk-item"><div class="perk-title">${ministerPerk.name || "Perk"}</div><div class="perk-desc">${minecraftToHtml(ministerPerk.description || "")}</div></div>`
                        : "<div class='empty'>Sin perk</div>"
                    }
                  </div>
                <div class="hint">Actualizado: ${formatUnix(data.lastUpdated)}</div>
              </div>
            </div>
            <div class="mayor-column">
              <div class="result-card">
                <div class="result-title">Votaciones Actuales <span class="badge">Año: ${election.year || "N/A"}</span></div>
                <div class="results">${candidateCards}</div>
              </div>
            </div>
          </div>
        `;
      }
    }
  } catch (err) {
    if (currentMayorLink) currentMayorLink.textContent = "Current Mayor: Error";
    if (mayorCard) mayorCard.innerHTML = `<div class="empty error">No se pudo cargar Mayor.</div>`;
    if (mayorPage) mayorPage.innerHTML = `<div class="empty error">No se pudo cargar Mayor.</div>`;
  }

  try {
    const bingoRes = await fetchJson(`${API_BASE}/resources/skyblock/bingo`);
      if (bingoRes.ok) {
        const data = bingoRes.data;
        const current = data.current || data;
        const modifier = current.modifier || current.mode || "N/A";
        if (currentBingoLink) {
          currentBingoLink.textContent = `Bingo: ${current.name || "N/A"}`;
        }
      if (bingoCard) {
        bingoCard.innerHTML = renderCard(current.name || "Bingo", [
          { label: "Start", value: formatUnix(current.start) },
          { label: "End", value: formatUnix(current.end) },
          { label: "Actualizado", value: formatUnix(data.lastUpdated) },
        ]);
      }
      if (bingoPage) {
        const goals = Array.isArray(current.goals) ? current.goals : [];
        const cards = goals.slice(0, 25).map((g, idx) => {
          const title = typeof g === "string" ? g : g.name || g.title || `Goal ${idx + 1}`;
          const desc = typeof g === "string" ? "" : (g.lore || g.description || "");
          const lore =
            typeof g === "string"
              ? g
              : Array.isArray(g.fullLore)
                ? g.fullLore.join("\n")
                : (g.lore || g.description || g.name || g.title || "");
          const isCommunity = idx % 6 === 0;
          const tiers = typeof g === "object" && Array.isArray(g.tiers) ? g.tiers.join(",") : "";
          const progress = typeof g === "object" && typeof g.progress === "number" ? String(g.progress) : "";
          let communityStyle = "";
          if (isCommunity && typeof g === "object" && Array.isArray(g.tiers) && typeof g.progress === "number") {
            const reached = g.tiers.filter((t) => typeof t === "number" && t <= g.progress).length;
            const ratio = g.tiers.length ? reached / g.tiers.length : 0;
            const alpha = (0.12 + 0.6 * ratio).toFixed(2);
            const borderAlpha = (0.25 + 0.55 * ratio).toFixed(2);
            communityStyle = `style="background: rgba(34,197,94,${alpha}); border-color: rgba(34,197,94,${borderAlpha});"`;
          }
          return `
            <div class="bingo-cell${isCommunity ? " community" : ""}" ${communityStyle}
              data-title="${encodeURIComponent(title)}"
              data-idx="${idx}"
              data-community="${isCommunity ? "1" : "0"}"
              data-tiers="${encodeURIComponent(tiers)}"
              data-progress="${encodeURIComponent(progress)}">
              <div class="cell-title">${title}</div>
              ${desc ? `<div class="perk-desc">${minecraftToHtml(desc)}</div>` : ""}
              <textarea class="goal-lore" hidden>${lore}</textarea>
              <textarea class="goal-desc" hidden>${desc}</textarea>
            </div>
          `;
        });
        const info = `
          <div class="result-card">
            <div class="result-title">${current.name || "Bingo"}</div>
            <div class="collection-meta">Inicio: ${formatUnix(current.start)}</div>
            <div class="collection-meta">Fin: ${formatUnix(current.end)}</div>
            <div class="collection-meta">Actualizado: ${formatUnix(data.lastUpdated)}</div>
            <div class="bingo-modifier">Modifier: ${modifier}</div>
            <div class="bingo-grid">${cards.join("") || "<div class='empty'>Sin objetivos</div>"}</div>
            <div class="bingo-points">
              <h3>Puntos de Bingo</h3>
              <div class="points-list">
                <div>Any Row or Column — <strong>+5 Bingo Points</strong></div>
                <div>The Community Diagonal — <strong>+5 Bingo Points</strong></div>
                <div>The Personal Diagonal — <strong>+10 Bingo Points</strong></div>
              </div>
            </div>
          </div>
        `;
        bingoPage.innerHTML = info;
      }
    }
  } catch (err) {
    if (bingoCard) bingoCard.innerHTML = `<div class="empty error">No se pudo cargar Bingo.</div>`;
    if (bingoPage) bingoPage.innerHTML = `<div class="empty error">No se pudo cargar Bingo.</div>`;
  }

  // Fire Sales removed from UI per request.
}

loadStaticPanels();
loadQueryFromUrl();

function startDemoTyping() {
  if (!demoArea || !demoText || !demoResults) return;
  if (demoTimer) return;
  demoTimer = setInterval(() => {
    if (demoPaused) return;
    if (!demoActive) return;
    if (queryInput && queryInput.value) return;
    if (demoResetting) return;
    const list = demoQueries[mode] || demoQueries.item;
    const entry = list[demoIndex % list.length];
    const text = entry.q;
    demoChar += 1;
    demoText.textContent = text.slice(0, demoChar);
    if (demoChar >= text.length) {
      demoResetting = true;
      setTimeout(() => {
        demoResults.innerHTML = `
          <div class="result-card">
            <div class="result-title">${entry.tier ? `<span class="${rarityClass(entry.tier)}">${entry.q}</span>` : entry.q}</div>
            ${entry.fields
              .map((f) => `<div><span class="badge">${f.label}</span> ${f.value}</div>`)
              .join("")}
          </div>
        `;
        demoChar = 0;
        demoIndex += 1;
        demoText.textContent = "";
        demoResetting = false;
      }, 900);
    }
  }, 120);
}

function loadQueryFromUrl() {
  if (!queryInput) return;
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q");
  const requestedMode = params.get("mode");
  if (requestedMode && ["item", "collection", "skill"].includes(requestedMode)) {
    setMode(requestedMode);
  }
  if (q) {
    queryInput.value = q;
    demoActive = false;
    if (demoArea) demoArea.style.display = "none";
    runSearch();
  }
}

const goalModal = document.getElementById("goalModal");
const modalClose = document.getElementById("modalClose");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");

if (bingoPage) {
  bingoPage.addEventListener("click", (event) => {
    const cell = event.target.closest(".bingo-cell");
    if (!cell || !goalModal || !modalTitle || !modalBody) return;
    const title = decodeURIComponent(cell.dataset.title || "Objetivo");
    const raw = cell.querySelector(".goal-lore")?.value || "";
    modalTitle.textContent = title;
    let body = raw;
    if (!body.trim() || body.trim() === title.trim()) {
      body = cell.querySelector(".goal-desc")?.value || "";
    }
    const html = minecraftToHtml(body).replace(/\n/g, "<br>");
    const isCommunity = cell.dataset.community === "1";
    const idx = Number(cell.dataset.idx || -1);
    const isPersonalDiagonal = idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20;
    let pointsLine = "+1 Bingo Point";
    let extra = `<div class="points-text">Puntos: ${pointsLine}</div>`;
    if (isCommunity) {
      extra = `
        <div class="points-text">Top 1%: +5 / +7 / +9 / +12 / +15</div>
        <div class="points-text">Top 5%: +4 / +5 / +7 / +10 / +12</div>
        <div class="points-text">Top 10%: +3 / +4 / +5 / +7 / +9</div>
        <div class="points-text">Top 25%: +2 / +3 / +3 / +5 / +7</div>
        <div class="points-text">All Contributors: +1 / +1 / +1 / +2 / +4</div>
      `;
    }
    modalBody.innerHTML = (html || "Sin descripción") + extra;
    goalModal.classList.add("active");
  });
}

if (modalClose && goalModal) {
  modalClose.addEventListener("click", () => goalModal.classList.remove("active"));
  goalModal.addEventListener("click", (event) => {
    if (event.target === goalModal) goalModal.classList.remove("active");
  });
}

if (results) {
  results.addEventListener("click", async (event) => {
    const card = event.target.closest(".level-card");
    if (!card || !goalModal || !modalTitle || !modalBody) return;
    await loadItems();
    const title = decodeURIComponent(card.dataset.title || "Nivel");
    const raw = decodeURIComponent(card.dataset.unlocks || "");
    modalTitle.textContent = title;
    const html = renderUnlockLines(raw) || "Sin unlocks";
    modalBody.innerHTML = html;
    goalModal.classList.add("active");
  });
}

if (goalModal && queryInput) {
  goalModal.addEventListener("click", (event) => {
    const btn = event.target.closest(".unlock-item");
    if (!btn || !modalTitle || !modalBody) return;
    const item = btn.dataset.item || "";
    if (!item) return;
      loadItems().then((items) => {
        const match = pickMatch(items, item);
        modalTitle.textContent = item;
        modalBody.innerHTML = renderItemDetails(match);
      });
    });
  }
