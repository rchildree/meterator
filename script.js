const SYMBOL_MAP = {
	"-": "\u2012", // Figure dash
	u: "\u222A", // Cup (union symbol)
	x: "\u00D7", // Multiplication sign
	A: "A",
	a: "a",
	B: "B",
	b: "b",
	C: "C",
	c: "c",
	D: "D",
	d: "d",
};

// Vowels and common diphthongs for auto-detection
// Includes Latin vowels (with macrons) and Ancient Greek vowels (with all diacritics)
const VOWEL_PATTERN =
	/[aeiouyæœāēīōūȳĀĒĪŌŪȲăĕĭŏŭĂĔĬŎŬâêîôûŷÂÊÎÔÛŶäëïöüÿÄËÏÖÜŸαεηιουωἀἁἂἃἄἅἆἇὀὁὂὃὄὅἐἑἒἓἔἕἠἡἢἣἤἥἦἧἰἱἲἳἴἵἶἷὐὑὒὓὔὕὖὗὠὡὢὣὤὥὦὧᾀᾁᾂᾃᾄᾅᾆᾇᾐᾑᾒᾓᾔᾕᾖᾗᾠᾡᾢᾣᾤᾥᾦᾧὰάᾰᾱᾲᾳᾴᾶᾷὲέὴήῂῃῄῆῇὶίῐῑῒΐῖῗὀόὸόὺύῠῡῢΰῦῧὼώῲῳῴῶῷ]/i;
// Latin: ae, au
// Greek: αι, ει, οι, υι, αυ, ευ, ου, ηυ (and with diacritics)
const DIPHTHONG_PATTERN =
	/ae|au|αι|ει|οι|υι|αυ|ευ|ου|ηυ|ἀι|ἁι|ἂι|ἃι|ἄι|ἅι|ἆι|ἇι|αὶ|αί|ᾶι|ἐι|ἑι|ἒι|ἓι|ἔι|ἕι|εὶ|εί|ὀι|ὁι|ὂι|ὃι|ὄι|ὅι|οὶ|οί|ὐι|ὑι|ὒι|ὓι|ὔι|ὕι|ὖι|ὗι|υὶ|υί|ῦι|ἀυ|ἁυ|ἂυ|ἃυ|ἄυ|ἅυ|ἆυ|ἇυ|αὺ|αύ|ᾶυ|ἐυ|ἑυ|ἒυ|ἓυ|ἔυ|ἕυ|εὺ|εύ|ὀυ|ὁυ|ὂυ|ὃυ|ὄυ|ὅυ|οὺ|ού|ὐυ|ὑυ|ὒυ|ὓυ|ὔυ|ὕυ|ὖυ|ὗυ|ηὺ|ηύ|ἠυ|ἡυ|ἢυ|ἣυ|ἤυ|ἥυ|ἦυ|ἧυ|ῆυ/i;

let currentTextId = null;
let currentText = null;
let syllablePositions = [];
let currentSyllableIndex = 0;
let currentMeter = "other"; // 'dactylic', 'iambo-trochaic', or 'other'

// Initialize
document.addEventListener("DOMContentLoaded", () => {
	const texts = loadSavedTexts();
	renderTextList();

	// Load the last viewed text if available
	const lastViewedId = localStorage.getItem("lastViewedTextId");
	if (lastViewedId && texts[lastViewedId]) {
		loadText(lastViewedId);
	} else {
		// Fallback to most recent text if last viewed is not available
		const textIds = Object.keys(texts).sort((a, b) => b - a);
		if (textIds.length > 0) {
			loadText(textIds[0]);
		}
	}
});

// Storage functions
function loadSavedTexts() {
	const saved = localStorage.getItem("syllableTexts");
	return saved ? JSON.parse(saved) : {};
}

function saveTexts(texts) {
	localStorage.setItem("syllableTexts", JSON.stringify(texts));
}

function uploadText() {
	document.getElementById("file-input").click();
}

function openMeteratorText() {
	document.getElementById("mtr-file-input").click();
}

function handleMtrFileUpload(event) {
	const file = event.target.files[0];
	if (!file) return;

	const reader = new FileReader();
	reader.onload = (e) => {
		const raw = e.target.result;
		// The .mtr.txt format is: marks line, text line, blank line, repeat.
		// Parse it back into plain content + marks object.
		const lines = raw.split("\n");
		const contentLines = [];
		const marksMap = {};
		let lineIndex = 0; // index into contentLines

		let i = 0;
		while (i < lines.length) {
			// Skip truly blank lines between pairs (stanza separators)
			if (lines[i] === "") {
				i++;
				continue;
			}
			// Expect: marks line, then text line (marks line may be all spaces for unscanned lines)
			const marksLine = lines[i] ?? "";
			const textLine = lines[i + 1] ?? "";
			i += 2;

			// Skip if both are empty (trailing newlines at end of file)
			if (marksLine === "" && textLine === "") continue;

			contentLines.push(textLine);
			marksMap[lineIndex] = marksLine;
			lineIndex++;
		}

		const content = contentLines.join("\n").replace(/&nbsp;/g, " ").replace(/\u00A0/g, " ");
		const textId = Date.now().toString();
		const texts = loadSavedTexts();

		texts[textId] = {
			name: file.name,
			content: content,
			marks: {},
		};

		saveTexts(texts);

		// Load the text so syllablePositions are built, then apply marks
		loadText(textId);

		// Now align marks from the marks lines to syllable positions
		const reverseSymbolMap = {
			"\u2012": "-",
			"\u222A": "u",
			"\u00D7": "x",
		};

		const combiningRe = /[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]/;

		syllablePositions.forEach((lineData, li) => {
			const marksLine = marksMap[li] ?? "";
			const textLine = lineData.lineText;

			const isDebugLine = textLine.includes("perd\u0101t") || textLine.includes("nimis\u0306");

			// Build a map from visual column -> mark character from the marks line.
			const markAtVisualCol = {};
			for (let mi = 0; mi < marksLine.length; mi++) {
				const c = marksLine[mi];
				if (c !== " " && c !== "\t") {
					markAtVisualCol[mi] = c;
				}
			}

			if (isDebugLine) {
				console.log(`[DEBUG li=${li}] textLine: ${JSON.stringify(textLine)}`);
				console.log(`[DEBUG li=${li}] marksLine: ${JSON.stringify(marksLine)}`);
				console.log(`[DEBUG li=${li}] markAtVisualCol:`, JSON.stringify(markAtVisualCol));
			}

			// For each syllable position (raw index into text), find its visual column,
			// then look up what mark (if any) sits at that visual column.
			lineData.positions.forEach((pos, pi) => {
				let visualCol = 0;
				for (let ci = 0; ci < pos.index; ci++) {
					if (!combiningRe.test(textLine[ci])) visualCol++;
				}
				const markChar = markAtVisualCol[visualCol];
				if (isDebugLine) {
					console.log(`[DEBUG li=${li} pi=${pi}] char=${JSON.stringify(pos.char)} rawIdx=${pos.index} visualCol=${visualCol} mark=${JSON.stringify(markChar ?? null)}`);
				}
				if (markChar) {
					const markKey = `${li}-${pi}`;
					currentText.marks[markKey] = reverseSymbolMap[markChar] ?? markChar;
				}
			});
		});

		saveCurrentText();
		renderEditor();
		renderTextList();
	};
	reader.readAsText(file);
	event.target.value = "";
}

function cleanText(text) {
	// Replace &nbsp; entities and non-breaking space characters with regular spaces
	text = text.replace(/&nbsp;/g, " ").replace(/\u00A0/g, " ");
	// Split by lines, filter out empty lines, then rejoin
	// Preserve tabs so scansion marks line up with input
	return text
		.split("\n")
		.filter((line) => line.trim().length > 0)
		.join("\n");
}

function handleFileUpload(event) {
	const file = event.target.files[0];
	if (!file) return;

	const reader = new FileReader();
	reader.onload = (e) => {
		const content = cleanText(e.target.result);
		const textId = Date.now().toString();
		const texts = loadSavedTexts();

		texts[textId] = {
			name: file.name,
			content: content,
			marks: {},
		};

		saveTexts(texts);
		loadText(textId);
		renderTextList();
	};
	reader.readAsText(file);
	event.target.value = ""; // Reset input
}

function showPasteModal() {
	document.getElementById("paste-modal").classList.add("show");
	document.getElementById("paste-area").focus();
}

function closePasteModal(event) {
	document.getElementById("paste-modal").classList.remove("show");
}

function loadFromPaste() {
	const pasteArea = document.getElementById("paste-area");
	const content = pasteArea.value.trim();

	if (!content) {
		alert("Please paste some text first");
		return;
	}

	const cleanedContent = cleanText(content);
	const textId = Date.now().toString();
	const texts = loadSavedTexts();

	// Generate a name based on first few words or timestamp
	const firstLine = cleanedContent.split("\n")[0];
	const textName =
		firstLine.substring(0, 30) + (firstLine.length > 30 ? "..." : "") + ".txt";

	texts[textId] = {
		name: textName,
		content: cleanedContent,
		marks: {},
	};

	saveTexts(texts);
	loadText(textId);
	renderTextList();

	// Clear and hide the modal
	pasteArea.value = "";
	closePasteModal();
}

function showHelpModal() {
	document.getElementById("help-modal").classList.add("show");
}

function closeHelpModal(event) {
	document.getElementById("help-modal").classList.remove("show");
}

function loadText(textId) {
	const texts = loadSavedTexts();
	const textData = texts[textId];

	if (!textData) return;

	currentTextId = textId;
	currentText = textData;
	currentSyllableIndex = 0;

	// Save this as the last viewed text
	localStorage.setItem("lastViewedTextId", textId);

	// Load meter setting if saved
	currentMeter = textData.meter || "other";
	document.getElementById("meter-type").value = currentMeter;

	// Parse text and find syllable positions
	parseTextForSyllables(textData.content);
	renderEditor();
	updateButtons();
	updateCurrentTextName();
}

function changeMeter() {
	if (!currentText) return;
	currentMeter = document.getElementById("meter-type").value;
	currentText.meter = currentMeter;
	saveCurrentText();
	renderEditor();
}

// Helper function to check if a character has a diaeresis (trema)
function hasDiaeresis(char) {
	// Unicode diaeresis/trema combining mark or precomposed characters with diaeresis
	return /[\u0308ϊϋΪΫῒῗῢῧ]/.test(char);
}

// Helper function to check if a character has an accent (acute, grave, or circumflex)
function hasAccent(char) {
	// Matches characters with acute, grave, or circumflex accents
	return /[άέήίόύώὰὲὴὶὸὺὼᾶῆῖῦῶἄἅἔἕἤἥἴἵὄὅὔὕὤὥᾴῄῴ]/.test(char);
}

// Helper function to check if a character has a breathing mark
function hasBreathing(char) {
	// Matches characters with smooth or rough breathing
	return /[ἀἁἂἃἄἅἆἇἐἑἒἓἔἕἠἡἢἣἤἥἦἧἰἱἲἳἴἵἶἷὀὁὂὃὄὅὐὑὒὓὔὕὖὗὠὡὢὣὤὥὦὧᾀᾁᾂᾃᾄᾅᾆᾇᾐᾑᾒᾓᾔᾕᾖᾗᾠᾡᾢᾣᾤᾥᾦᾧ]/.test(
		char,
	);
}

// Helper function to get the base vowel without diacritics
function getBaseVowel(char) {
	const vowelMap = {
		α: "α",
		ά: "α",
		ὰ: "α",
		ᾶ: "α",
		ἀ: "α",
		ἁ: "α",
		ἂ: "α",
		ἃ: "α",
		ἄ: "α",
		ἅ: "α",
		ἆ: "α",
		ἇ: "α",
		ᾀ: "α",
		ᾁ: "α",
		ᾂ: "α",
		ᾃ: "α",
		ᾄ: "α",
		ᾅ: "α",
		ᾆ: "α",
		ᾇ: "α",
		ᾰ: "α",
		ᾱ: "α",
		ᾲ: "α",
		ᾳ: "α",
		ᾴ: "α",
		ᾷ: "α",
		ε: "ε",
		έ: "ε",
		ὲ: "ε",
		ἐ: "ε",
		ἑ: "ε",
		ἒ: "ε",
		ἓ: "ε",
		ἔ: "ε",
		ἕ: "ε",
		η: "η",
		ή: "η",
		ὴ: "η",
		ῆ: "η",
		ἠ: "η",
		ἡ: "η",
		ἢ: "η",
		ἣ: "η",
		ἤ: "η",
		ἥ: "η",
		ἦ: "η",
		ἧ: "η",
		ᾐ: "η",
		ᾑ: "η",
		ᾒ: "η",
		ᾓ: "η",
		ᾔ: "η",
		ᾕ: "η",
		ᾖ: "η",
		ᾗ: "η",
		ῂ: "η",
		ῃ: "η",
		ῄ: "η",
		ῇ: "η",
		ι: "ι",
		ί: "ι",
		ὶ: "ι",
		ῖ: "ι",
		ϊ: "ι",
		ΐ: "ι",
		ῒ: "ι",
		ῗ: "ι",
		ἰ: "ι",
		ἱ: "ι",
		ἲ: "ι",
		ἳ: "ι",
		ἴ: "ι",
		ἵ: "ι",
		ἶ: "ι",
		ἷ: "ι",
		ῐ: "ι",
		ῑ: "ι",
		ο: "ο",
		ό: "ο",
		ὸ: "ο",
		ὀ: "ο",
		ὁ: "ο",
		ὂ: "ο",
		ὃ: "ο",
		ὄ: "ο",
		ὅ: "ο",
		υ: "υ",
		ύ: "υ",
		ὺ: "υ",
		ῦ: "υ",
		ϋ: "υ",
		ΰ: "υ",
		ῢ: "υ",
		ῧ: "υ",
		ὐ: "υ",
		ὑ: "υ",
		ὒ: "υ",
		ὓ: "υ",
		ὔ: "υ",
		ὕ: "υ",
		ὖ: "υ",
		ὗ: "υ",
		ῠ: "υ",
		ῡ: "υ",
		ω: "ω",
		ώ: "ω",
		ὼ: "ω",
		ῶ: "ω",
		ὠ: "ω",
		ὡ: "ω",
		ὢ: "ω",
		ὣ: "ω",
		ὤ: "ω",
		ὥ: "ω",
		ὦ: "ω",
		ὧ: "ω",
		ᾠ: "ω",
		ᾡ: "ω",
		ᾢ: "ω",
		ᾣ: "ω",
		ᾤ: "ω",
		ᾥ: "ω",
		ᾦ: "ω",
		ᾧ: "ω",
		ῲ: "ω",
		ῳ: "ω",
		ῴ: "ω",
		ῷ: "ω",
	};
	return vowelMap[char.toLowerCase()] || char.toLowerCase();
}

// Check if two characters form a true diphthong
function isTrueDiphthong(char1, char2, fullString, position) {
	const base1 = getBaseVowel(char1);
	const base2 = getBaseVowel(char2);

	// Check if it's a potential diphthong pattern (αι, ει, οι, υι, αυ, ευ, ου, ηυ)
	const pattern = base1 + base2;
	if (!/^(αι|ει|οι|υι|αυ|ευ|ου|ηυ|ae|au)$/.test(pattern)) {
		return false;
	}

	// Rule 1: If second vowel has diaeresis, they are separate syllables
	if (hasDiaeresis(char2)) {
		return false;
	}

	// Rule 2: If first vowel has an accent AND second vowel has no breathing/accent, they are separate
	// But if second vowel has breathing or accent (e.g., εἰ, οἳ), it's still a diphthong
	if (hasAccent(char1) && !hasBreathing(char2) && !hasAccent(char2)) {
		return false;
	}

	// Rule 3: If second vowel has a breathing mark AND first vowel has accent, they are separate
	// But if only second has breathing (no accent on first), it's a diphthong (e.g., εἰ)
	if (hasBreathing(char2) && hasAccent(char1)) {
		return false;
	}

	// Latin diphthongs (ae, au) - simple check
	if (pattern === "ae" || pattern === "au") {
		return true;
	}

	// Otherwise, it's a true diphthong
	return true;
}

function parseTextForSyllables(text) {
	syllablePositions = [];
	// Normalize to NFC (precomposed form) to ensure consistent vowel matching
	text = text.normalize('NFC');
	const lines = text.split("\n");

	lines.forEach((line, lineIndex) => {
		const positions = [];
		let i = 0;

		while (i < line.length) {
			// Skip 'u' if it follows 'q' (qu is not a vowel)
			if (
				i > 0 &&
				line[i].toLowerCase() === "u" &&
				line[i - 1].toLowerCase() === "q"
			) {
				i++;
				continue;
			}

			// Check for diphthongs first
			let foundDiphthong = false;
			if (
				i < line.length - 1 &&
				VOWEL_PATTERN.test(line[i]) &&
				VOWEL_PATTERN.test(line[i + 1])
			) {
				// Check if this is a true diphthong using the sophisticated rules
				if (isTrueDiphthong(line[i], line[i + 1], line, i)) {
					// Place the mark over the second vowel of the diphthong
					positions.push({
						char: line[i + 1],
						index: i + 1,
						isDiphthong: true,
					});
					foundDiphthong = true;
					i += 2;
				}
			}

			if (!foundDiphthong) {
				if (VOWEL_PATTERN.test(line[i])) {
					positions.push({ char: line[i], index: i, isDiphthong: false });
				}
				i++;
			}
		}

		syllablePositions.push({
			lineIndex,
			lineText: line,
			positions,
		});
	});
}

function renderEditor() {
	const editor = document.getElementById("editor");

	if (!currentText) {
		editor.innerHTML = "";
		return;
	}

	editor.innerHTML = "";

	syllablePositions.forEach((lineData, lineIndex) => {
		const lineDiv = document.createElement("div");
		lineDiv.className = "text-line";
		lineDiv.dataset.lineIndex = lineIndex;

		// Marks row
		const marksRow = document.createElement("div");
		marksRow.className = "marks-row";

		// Build marks with proper spacing
		let markHtml = "";
		let lastIndex = 0;

		lineData.positions.forEach((pos, posIndex) => {
			// Add spaces/tabs before this mark to match the text
			// Skip combining characters (they don't take up space)
			let spacing = "";
			for (let i = lastIndex; i < pos.index; i++) {
				const char = lineData.lineText[i];
				// Check if it's a combining character (U+0300–U+036F and other combining ranges)
				const isCombining =
					/[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]/.test(
						char,
					);
				if (!isCombining) {
					// Treat emdash as two spaces
					if (char === "—") {
						spacing += " ";
					} else {
						spacing += char === "\t" ? "\t" : " ";
					}
				}
			}
			markHtml += spacing;

			// Get the mark for this position
			const markKey = `${lineIndex}-${posIndex}`;
			const markValue = currentText.marks[markKey] || "";
			const globalIndex = getGlobalSyllableIndex(lineIndex, posIndex);
			const isActive = globalIndex === currentSyllableIndex;

			// Display the mark
			let displayMark = "";
			let isEmpty = false;
			if (markValue === "-") {
				displayMark = "\u2012"; // Figure dash
			} else if (markValue === "u") {
				displayMark = "\u222A"; // Cup
			} else if (markValue === "x") {
				displayMark = "\u00D7"; // Multiplication sign
			} else if (markValue) {
				displayMark = markValue;
			} else {
				displayMark = " ";
				isEmpty = true;
			}

			// Check for errors
			const hasError = checkForError(lineIndex, posIndex);
			const errorClass = hasError ? "error" : "";
			const emptyClass = isEmpty ? "empty" : "";

			markHtml += `<span class="mark ${isActive ? "active" : ""} ${errorClass} ${emptyClass}" data-line="${lineIndex}" data-pos="${posIndex}">${displayMark}</span>`;
			lastIndex = pos.index + 1;
		});

		marksRow.innerHTML = markHtml;

		// Text row
		const textRow = document.createElement("div");
		textRow.className = "text-row";
		textRow.textContent = lineData.lineText;

		lineDiv.appendChild(marksRow);
		lineDiv.appendChild(textRow);
		editor.appendChild(lineDiv);
	});

	// Scroll to center the current line
	scrollToCurrentLine();
}

function scrollToCurrentLine() {
	const syllable = findSyllableByGlobalIndex(currentSyllableIndex);
	if (!syllable) return;

	const lineDiv = document.querySelector(
		`[data-line-index="${syllable.lineIndex}"]`,
	);
	if (!lineDiv) return;

	const mainContent = document.getElementById("main-content");
	const lineDivRect = lineDiv.getBoundingClientRect();
	const mainContentRect = mainContent.getBoundingClientRect();

	// Calculate offset to center the line
	const lineCenter = lineDiv.offsetTop + lineDivRect.height / 2;
	const viewportCenter = mainContent.scrollTop + mainContentRect.height / 2;
	const scrollTarget =
		lineDiv.offsetTop - mainContentRect.height / 2 + lineDivRect.height / 2;

	mainContent.scrollTop = scrollTarget;
}

function checkForError(lineIndex, posIndex) {
	if (currentMeter === "other") return false;

	const lineData = syllablePositions[lineIndex];
	if (!lineData) return false;

	// Get all marks for this line (non-empty only)
	const lineMarks = [];
	lineData.positions.forEach((pos, idx) => {
		const markKey = `${lineIndex}-${idx}`;
		const markValue = currentText.marks[markKey];
		if (markValue) {
			lineMarks.push({ posIndex: idx, value: markValue });
		}
	});

	if (currentMeter === "dactylic") {
		// Find this position in the non-empty marks
		const currentMarkIndex = lineMarks.findIndex(
			(m) => m.posIndex === posIndex,
		);
		if (currentMarkIndex === -1) return false;

		const currentMark = lineMarks[currentMarkIndex];
		const prevMark =
			currentMarkIndex > 0 ? lineMarks[currentMarkIndex - 1] : null;
		const prevPrevMark =
			currentMarkIndex > 1 ? lineMarks[currentMarkIndex - 2] : null;

		// First position must be long
		if (currentMarkIndex === 0 && currentMark.value !== "-") {
			return true;
		}

		// A short must be followed by another short OR can be the second of two shorts followed by a long
		if (prevMark && prevMark.value === "u") {
			// If previous is short and current is NOT short
			if (currentMark.value !== "u") {
				// Check if the mark before previous was also short (making this the third position: u u -)
				// If so, this is allowed (two shorts followed by a long)
				if (prevPrevMark && prevPrevMark.value === "u") {
					// This is okay: u u - pattern
				} else {
					// Error: single short not followed by another short
					return true;
				}
			}
		}

		// Two shorts MUST be followed by a long
		if (
			prevMark &&
			prevPrevMark &&
			prevMark.value === "u" &&
			prevPrevMark.value === "u"
		) {
			// This is the position after two shorts
			if (currentMark.value !== "-") {
				return true;
			}
		}
	} else if (currentMeter === "iambo-trochaic") {
		const currentMarkIndex = lineMarks.findIndex(
			(m) => m.posIndex === posIndex,
		);
		if (currentMarkIndex === -1) return false;

		const currentMark = lineMarks[currentMarkIndex];
		const prevMark =
			currentMarkIndex > 0 ? lineMarks[currentMarkIndex - 1] : null;
		const nextMark =
			currentMarkIndex < lineMarks.length - 1
				? lineMarks[currentMarkIndex + 1]
				: null;

		// 'b' must come in pairs (exactly 2 consecutive b's)
		if (currentMark.value === "b") {
			// Must have exactly one 'b' adjacent (either before or after)
			const hasPrevB = prevMark && prevMark.value === "b";
			const hasNextB = nextMark && nextMark.value === "b";

			if (!hasPrevB && !hasNextB) {
				// Isolated 'b' - error
				return true;
			}

			// Check for triple or more b's
			if (hasPrevB && hasNextB) {
				// Middle of 3+ b's - error
				return true;
			}

			// If this is the second 'b', check if there's a third
			if (hasPrevB) {
				const prevPrevMark =
					currentMarkIndex > 1 ? lineMarks[currentMarkIndex - 2] : null;
				if (prevPrevMark && prevPrevMark.value === "b") {
					// Third b in a row - error
					return true;
				}
			}
		}

		// 'd' must come in pairs (exactly 2 consecutive d's)
		if (currentMark.value === "d") {
			// Must have exactly one 'd' adjacent (either before or after)
			const hasPrevD = prevMark && prevMark.value === "d";
			const hasNextD = nextMark && nextMark.value === "d";

			if (!hasPrevD && !hasNextD) {
				// Isolated 'd' - error
				return true;
			}

			// Check for triple or more d's
			if (hasPrevD && hasNextD) {
				// Middle of 3+ d's - error
				return true;
			}

			// If this is the second 'd', check if there's a third
			if (hasPrevD) {
				const prevPrevMark =
					currentMarkIndex > 1 ? lineMarks[currentMarkIndex - 2] : null;
				if (prevPrevMark && prevPrevMark.value === "d") {
					// Third d in a row - error
					return true;
				}
			}
		}

		// Lines must not start with C/c or D/d
		if (currentMarkIndex === 0) {
			if (
				currentMark.value === "C" ||
				currentMark.value === "c" ||
				currentMark.value === "D" ||
				currentMark.value === "d"
			) {
				return true;
			}
		}

		if (!prevMark) return false;

		// Forbidden consecutive pairs (all case combinations and duplicates)
		const forbidden = [
			["A", "A"],
			["B", "B"],
			["C", "C"],
			["D", "D"],
			["A", "a"],
			["a", "A"],
			["B", "b"],
			["b", "B"],
			["C", "c"],
			["c", "C"],
			["D", "d"],
			["d", "D"],
		];

		for (const [first, second] of forbidden) {
			if (prevMark.value === first && currentMark.value === second) {
				return true;
			}
		}

		// Letters must proceed in order through letter types: A→B→C→D (or B→C→D→A)
		// Within each letter type, the same letter can repeat (like bb, cc, dd)
		// But we need to ensure we're moving through the correct letter sequence

		// Get the letter type (ignoring case)
		const getLetterType = (letter) => letter.toUpperCase();

		// Check if both marks are letters
		const prevIsLetter = /[ABCDabcd]/.test(prevMark.value);
		const currentIsLetter = /[ABCDabcd]/.test(currentMark.value);

		if (prevIsLetter && currentIsLetter) {
			const prevType = getLetterType(prevMark.value);
			const currentType = getLetterType(currentMark.value);

			// If same letter type, it's allowed (already handled by forbidden pairs check)
			// If different letter types, must follow the sequence
			if (prevType !== currentType) {
				// Define valid letter type transitions
				const validTransitions = {
					A: ["B"],
					B: ["C"],
					C: ["D"],
					D: ["A"],
				};

				const allowedNext = validTransitions[prevType];
				if (!allowedNext || !allowedNext.includes(currentType)) {
					// Invalid letter sequence
					return true;
				}
			}
		}
	}

	return false;
}

function getGlobalSyllableIndex(lineIndex, posIndex) {
	let count = 0;
	for (let i = 0; i < lineIndex; i++) {
		count += syllablePositions[i].positions.length;
	}
	return count + posIndex;
}

function findSyllableByGlobalIndex(globalIndex) {
	let count = 0;
	for (let lineIndex = 0; lineIndex < syllablePositions.length; lineIndex++) {
		const linePositions = syllablePositions[lineIndex].positions.length;
		if (globalIndex < count + linePositions) {
			return { lineIndex, posIndex: globalIndex - count };
		}
		count += linePositions;
	}
	return null;
}

function getTotalSyllables() {
	return syllablePositions.reduce(
		(sum, line) => sum + line.positions.length,
		0,
	);
}

function advanceToNextSyllable() {
	const total = getTotalSyllables();
	if (currentSyllableIndex < total - 1) {
		currentSyllableIndex++;
		renderEditor();
	}
}

function moveToPreviousSyllable() {
	if (currentSyllableIndex > 0) {
		currentSyllableIndex--;
		renderEditor();
	}
}

// Keyboard handling
document.addEventListener("keydown", (e) => {
	if (!currentText) return;

	// Ignore if in an input field (but allow if it's the paste area and we're not typing)
	if (e.target.tagName === "INPUT" || e.target.id === "paste-area") return;
	if (e.target.tagName === "TEXTAREA" && e.target.id !== "paste-area") return;

	const key = e.key;

	// Handle valid input keys
	if (SYMBOL_MAP.hasOwnProperty(key)) {
		e.preventDefault();
		const syllable = findSyllableByGlobalIndex(currentSyllableIndex);
		if (syllable) {
			const markKey = `${syllable.lineIndex}-${syllable.posIndex}`;
			currentText.marks[markKey] = key;
			saveCurrentText();
			advanceToNextSyllable();
		}
	} else if (key === "Tab" || key === " ") {
		e.preventDefault();
		// Clear current mark if it exists
		const syllable = findSyllableByGlobalIndex(currentSyllableIndex);
		if (syllable) {
			const markKey = `${syllable.lineIndex}-${syllable.posIndex}`;
			delete currentText.marks[markKey];
			saveCurrentText();
		}
		advanceToNextSyllable();
	} else if (key === "Backspace") {
		e.preventDefault();
		const syllable = findSyllableByGlobalIndex(currentSyllableIndex);
		if (syllable) {
			const markKey = `${syllable.lineIndex}-${syllable.posIndex}`;
			delete currentText.marks[markKey];
			saveCurrentText();
			renderEditor();
		}
		moveToPreviousSyllable();
	} else if (key === "Delete") {
		e.preventDefault();
		const syllable = findSyllableByGlobalIndex(currentSyllableIndex);
		if (syllable) {
			const markKey = `${syllable.lineIndex}-${syllable.posIndex}`;
			delete currentText.marks[markKey];
			saveCurrentText();
			renderEditor();
		}
	} else if (key === "ArrowLeft") {
		e.preventDefault();
		moveToPreviousSyllable();
	} else if (key === "ArrowRight") {
		e.preventDefault();
		advanceToNextSyllable();
	}
});

function saveCurrentText() {
	if (!currentTextId || !currentText) return;
	const texts = loadSavedTexts();
	texts[currentTextId] = currentText;
	saveTexts(texts);
}

function downloadCurrent() {
	if (!currentText) return;

	// Build the marked text (same as copyCurrent)
	let output = "";

	syllablePositions.forEach((lineData, lineIndex) => {
		// Build marks line
		let marksLine = "";
		let lastIndex = 0;

		lineData.positions.forEach((pos, posIndex) => {
			// Add the actual characters (including tabs) before this mark
			// Skip combining characters so mark positions align with pos.index on read-back
			const charsBeforeMark = lineData.lineText.substring(
				lastIndex,
				pos.index,
			);
			const spacing = charsBeforeMark
				.split("")
				.map((c) => {
					if (/[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]/.test(c)) return "";
					return c === "\t" ? "\t" : c === "—" ? " " : " ";
				})
				.join("");
			marksLine += spacing;

			// Get the mark for this position
			const markKey = `${lineIndex}-${posIndex}`;
			const markValue = currentText.marks[markKey] || "";

			let displayMark = "";
			if (markValue === "-") {
				displayMark = "\u2012"; // Figure dash
			} else if (markValue === "u") {
				displayMark = "\u222A"; // Cup
			} else if (markValue === "x") {
				displayMark = "\u00D7"; // Multiplication sign
			} else if (markValue) {
				displayMark = markValue;
			} else {
				displayMark = " ";
			}

			marksLine += displayMark;
			lastIndex = pos.index + 1;
		});

		// Add both lines to output
		output += marksLine + "\n";
		output += lineData.lineText + "\n";

		// Add blank line between stanzas
		if (lineIndex < syllablePositions.length - 1) {
			output += "\n";
		}
	});

	// Create timestamp prefix in format YYYY-MM-DD_HH-MM-SS
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	const hours = String(now.getHours()).padStart(2, '0');
	const minutes = String(now.getMinutes()).padStart(2, '0');
	const seconds = String(now.getSeconds()).padStart(2, '0');
	const timestamp = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;

	const baseName = currentText.name.replace(/\.mtr\.txt$|\.txt$/, "");
	const filename = `${timestamp}_${baseName}.mtr.txt`;

	const blob = new Blob([output], { type: "text/plain" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

function deleteText(textId, event) {
	event.stopPropagation(); // Prevent loading the text when clicking delete

	const texts = loadSavedTexts();
	const textName = texts[textId].name;

	if (!confirm(`Delete "${textName}"?`)) return;

	delete texts[textId];
	saveTexts(texts);

	// If we deleted the currently loaded text, clear it
	if (textId === currentTextId) {
		currentTextId = null;
		currentText = null;
		syllablePositions = [];
		currentSyllableIndex = 0;
		renderEditor();
		updateButtons();
		updateCurrentTextName();
	}

	renderTextList();
}

function renderTextList() {
	const texts = loadSavedTexts();
	const listEl = document.getElementById("text-list");

	listEl.innerHTML = "";

	const textIds = Object.keys(texts).sort((a, b) => b - a); // Most recent first

	if (textIds.length === 0) {
		listEl.innerHTML =
			'<div style="color: #7f8c8d; font-size: 12px; padding: 10px;">No saved texts</div>';
		return;
	}

	textIds.forEach((textId) => {
		const wrapper = document.createElement("div");
		wrapper.className = "text-list-item-wrapper";

		const item = document.createElement("div");
		item.className = "text-item";
		if (textId === currentTextId) {
			item.classList.add("active");
		}
		item.textContent = texts[textId].name;
		item.onclick = () => loadText(textId);

		const deleteIcon = document.createElement("span");
		deleteIcon.className = "delete-icon";
		deleteIcon.innerHTML =
			'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2zm3.354 4.646L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 1 1 .708-.708"/></svg>';
		deleteIcon.onclick = (e) => deleteText(textId, e);

		wrapper.appendChild(item);
		wrapper.appendChild(deleteIcon);
		listEl.appendChild(wrapper);
	});
}

function updateButtons() {
	const hasText = currentText !== null;
	document.getElementById("copy-btn").disabled = !hasText;
	document.getElementById("download-btn").disabled = !hasText;
}

function copyCurrent() {
	if (!currentText) return;

	// Build the marked text
	let output = "";

	syllablePositions.forEach((lineData, lineIndex) => {
		// Build marks line
		let marksLine = "";
		let lastIndex = 0;

		lineData.positions.forEach((pos, posIndex) => {
			// Add the actual characters (including tabs) before this mark
			// Skip combining characters so mark positions align with pos.index on read-back
			const charsBeforeMark = lineData.lineText.substring(
				lastIndex,
				pos.index,
			);
			const spacing = charsBeforeMark
				.split("")
				.map((c) => {
					if (/[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]/.test(c)) return "";
					return c === "\t" ? "\t" : c === "—" ? " " : " ";
				})
				.join("");
			marksLine += spacing;

			// Get the mark for this position
			const markKey = `${lineIndex}-${posIndex}`;
			const markValue = currentText.marks[markKey] || "";

			let displayMark = "";
			if (markValue === "-") {
				displayMark = "\u2012"; // Figure dash
			} else if (markValue === "u") {
				displayMark = "\u222A"; // Cup
			} else if (markValue === "x") {
				displayMark = "\u00D7"; // Multiplication sign
			} else if (markValue) {
				displayMark = markValue;
			} else {
				displayMark = " ";
			}

			marksLine += displayMark;
			lastIndex = pos.index + 1;
		});

		// Add both lines to output
		output += marksLine + "\n";
		output += lineData.lineText + "\n";

		// Add blank line between stanzas
		if (lineIndex < syllablePositions.length - 1) {
			output += "\n";
		}
	});

	// Copy to clipboard
	navigator.clipboard
		.writeText(output)
		.then(() => {
			// Visual feedback
			const btn = document.getElementById("copy-btn");
			const originalText = btn.textContent;
			btn.textContent = "Copied!";
			setTimeout(() => {
				btn.textContent = originalText;
			}, 1500);
		})
		.catch((err) => {
			alert("Failed to copy to clipboard");
			console.error("Copy failed:", err);
		});
}

function updateCurrentTextName() {
	const nameEl = document.getElementById("current-text-name");
	if (currentText) {
		nameEl.textContent = `Current: ${currentText.name}`;
	} else {
		nameEl.textContent = "";
	}
}

// Click on marks to jump to that syllable
document.getElementById("editor").addEventListener("click", (e) => {
	if (e.target.classList.contains("mark")) {
		const lineIndex = parseInt(e.target.dataset.line);
		const posIndex = parseInt(e.target.dataset.pos);
		currentSyllableIndex = getGlobalSyllableIndex(lineIndex, posIndex);
		renderEditor();
	}
});