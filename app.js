const form = document.getElementById("player-form");
const usernameInput = document.getElementById("username");
const statusText = document.getElementById("status");
const loading = document.getElementById("loading");
const profile = document.getElementById("profile");
const avatar = document.getElementById("avatar");
const displayName = document.getElementById("display-name");
const usernameHandle = document.getElementById("username-handle");
const userIdText = document.getElementById("user-id");
const joinDateText = document.getElementById("join-date");
const bioText = document.getElementById("bio");

function setStatus(message) {
  statusText.textContent = message;
}

function setLoading(isLoading) {
  loading.classList.toggle("hidden", !isLoading);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }

  return response.json();
}

async function getUserIdFromUsername(username) {
  const payload = {
    usernames: [username],
    excludeBannedUsers: false
  };

  const result = await fetchJson("https://users.roproxy.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const user = result.data?.[0];
  if (!user?.id) {
    throw new Error("User not found.");
  }

  return user.id;
}

async function getUserDetails(userId) {
  return fetchJson(`https://users.roproxy.com/v1/users/${userId}`);
}

async function getAvatarHeadshot(userId) {
  const result = await fetchJson(
    `https://thumbnails.roproxy.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
  );

  return result.data?.[0]?.imageUrl || "";
}

function renderUser(details, avatarUrl) {
  const joined = new Date(details.created).toLocaleDateString();

  displayName.textContent = details.displayName || details.name;
  usernameHandle.textContent = `@${details.name}`;
  userIdText.textContent = String(details.id);
  joinDateText.textContent = joined;
  bioText.textContent = details.description?.trim() || "No bio provided.";
  avatar.src = avatarUrl;
  profile.classList.remove("hidden");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = usernameInput.value.trim();
  if (!username) {
    setStatus("Please enter a username.");
    return;
  }

  profile.classList.add("hidden");
  setStatus("");
  setLoading(true);

  try {
    const userId = await getUserIdFromUsername(username);
    const [details, avatarUrl] = await Promise.all([getUserDetails(userId), getAvatarHeadshot(userId)]);

    renderUser(details, avatarUrl);
    setStatus("User found.");
  } catch (error) {
    setStatus(error.message || "Something went wrong while fetching user data.");
  } finally {
    setLoading(false);
  }
});
