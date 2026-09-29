const STORAGE_KEYS = {
  contacts: "suraksha_contacts",
  complaints: "suraksha_complaints"
};

const $ = (selector) => document.querySelector(selector);

let sosTimer = null;
let sosStartedAt = null;
let recognition = null;

function readStorage(key, fallback = []) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function setStatus(selector, message, type = "") {
  const element = $(selector);
  element.textContent = message;
  element.className = `status ${type}`.trim();
}

function createReference(prefix) {
  const time = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${time}-${random}`;
}

function startDemoSOS(source = "manual") {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      const mapLink = `https://maps.google.com/?q=${latitude},${longitude}`;

      setStatus(
        "#alertStatus",
        `Demo alert triggered by ${source}. Location prepared: ${mapLink}`,
        "success"
      );
    },
    () => {
      setStatus(
        "#alertStatus",
        `Demo alert triggered by ${source}. Location permission was unavailable.`,
        "error"
      );
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

function beginSOSHold() {
  if (sosTimer) return;

  sosStartedAt = Date.now();
  setStatus("#alertStatus", "Keep holding… alert starts after 3 seconds.");

  sosTimer = setTimeout(() => {
    sosTimer = null;
    startDemoSOS("manual SOS");
  }, 3000);
}

function cancelSOSHold() {
  if (!sosTimer) return;

  clearTimeout(sosTimer);
  sosTimer = null;
  setStatus("#alertStatus", "SOS cancelled.");
}

function renderContacts() {
  const contacts = readStorage(STORAGE_KEYS.contacts);
  const list = $("#contactList");
  list.innerHTML = "";

  if (!contacts.length) {
    list.innerHTML = "<li>No emergency contacts added.</li>";
    return;
  }

  contacts.forEach((contact, index) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <strong>${escapeHtml(contact.name)}</strong><br />
      ${escapeHtml(contact.phone)}
      <button class="danger-outline remove-contact" data-index="${index}">
        Remove
      </button>
    `;
    list.appendChild(item);
  });
}

function renderComplaints() {
  const complaints = readStorage(STORAGE_KEYS.complaints);
  const list = $("#complaintList");

  if (!complaints.length) {
    list.innerHTML = "<p>No complaints submitted.</p>";
    return;
  }

  list.innerHTML = complaints
    .map(
      (complaint) => `
        <article class="complaint-item">
          <strong>${escapeHtml(complaint.reference)}</strong>
          <p><strong>Type:</strong> ${escapeHtml(complaint.type)}</p>
          <p><strong>Date:</strong> ${escapeHtml(complaint.date)}</p>
          <p><strong>Location:</strong> ${escapeHtml(complaint.location)}</p>
          <p><strong>Status:</strong> ${escapeHtml(complaint.status)}</p>
          <p>${escapeHtml(complaint.description)}</p>
        </article>
      `
    )
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

$("#sosButton").addEventListener("pointerdown", beginSOSHold);
$("#sosButton").addEventListener("pointerup", cancelSOSHold);
$("#sosButton").addEventListener("pointerleave", cancelSOSHold);
$("#sosButton").addEventListener("pointercancel", cancelSOSHold);

$("#locationButton").addEventListener("click", () => {
  if (!navigator.geolocation) {
    setStatus("#locationStatus", "Geolocation is not supported.", "error");
    return;
  }

  setStatus("#locationStatus", "Requesting location…");

  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      const link = `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`;
      setStatus("#locationStatus", `Demo location ready: ${link}`, "success");
    },
    () => setStatus("#locationStatus", "Location permission was denied.", "error"),
    { enableHighAccuracy: true, timeout: 8000 }
  );
});

$("#contactForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const contacts = readStorage(STORAGE_KEYS.contacts);
  contacts.push({
    name: $("#contactName").value.trim(),
    phone: $("#contactPhone").value.trim()
  });

  writeStorage(STORAGE_KEYS.contacts, contacts);
  event.target.reset();
  renderContacts();
});

$("#contactList").addEventListener("click", (event) => {
  if (!event.target.classList.contains("remove-contact")) return;

  const index = Number(event.target.dataset.index);
  const contacts = readStorage(STORAGE_KEYS.contacts);
  contacts.splice(index, 1);
  writeStorage(STORAGE_KEYS.contacts, contacts);
  renderContacts();
});

$("#verificationButton").addEventListener("click", () => {
  setStatus(
    "#verificationStatus",
    "Demo only: connect an authorized identity-verification provider. No Aadhaar data was collected.",
    "success"
  );
});

$("#complaintForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const complaint = {
    reference: createReference("SA"),
    type: $("#complaintType").value,
    date: $("#incidentDate").value,
    location: $("#incidentLocation").value.trim(),
    description: $("#complaintDescription").value.trim(),
    status: "Draft — local demo only",
    createdAt: new Date().toISOString()
  };

  const complaints = readStorage(STORAGE_KEYS.complaints);
  complaints.unshift(complaint);
  writeStorage(STORAGE_KEYS.complaints, complaints);

  event.target.reset();
  renderComplaints();

  setStatus(
    "#complaintStatus",
    `Demo complaint saved locally. Reference: ${complaint.reference}`,
    "success"
  );
});

$("#clearData").addEventListener("click", () => {
  const confirmed = window.confirm(
    "Clear all local demo contacts and complaints?"
  );

  if (!confirmed) return;

  localStorage.removeItem(STORAGE_KEYS.contacts);
  localStorage.removeItem(STORAGE_KEYS.complaints);
  renderContacts();
  renderComplaints();
  setStatus("#complaintStatus", "Local demo data cleared.");
});

function setupVoiceRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    setStatus(
      "#voiceStatus",
      "Speech recognition is not supported in this browser.",
      "error"
    );
    return null;
  }

  const instance = new SpeechRecognition();
  instance.continuous = true;
  instance.interimResults = false;
  instance.lang = "en-IN";

  instance.onstart = () => {
    setStatus("#voiceStatus", "Listening for your emergency phrase…", "success");
  };

  instance.onerror = (event) => {
    setStatus("#voiceStatus", `Voice error: ${event.error}`, "error");
  };

  instance.onend = () => {
    setStatus("#voiceStatus", "Voice mode is off.");
  };

  instance.onresult = (event) => {
    const phrase = $("#voicePhrase").value.trim().toLowerCase();
    const transcript = Array.from(event.results)
      .slice(event.resultIndex)
      .map((result) => result[0].transcript.toLowerCase())
      .join(" ");

    if (phrase && transcript.includes(phrase)) {
      instance.stop();
      startDemoSOS("voice phrase");
    }
  };

  return instance;
}

$("#startVoice").addEventListener("click", () => {
  recognition = recognition || setupVoiceRecognition();
  if (!recognition) return;

  try {
    recognition.start();
  } catch {
    setStatus("#voiceStatus", "Voice mode is already active.");
  }
});

$("#stopVoice").addEventListener("click", () => {
  if (recognition) recognition.stop();
  setStatus("#voiceStatus", "Voice mode stopped.");
});

renderContacts();
renderComplaints();
