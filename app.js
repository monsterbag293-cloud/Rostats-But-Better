const form = document.getElementById("player-form");
const usernameInput = document.getElementById("username");
const statusText = document.getElementById("status");
const profile = document.getElementById("profile");
const avatar = document.getElementById("avatar");
const displayName = document.getElementById("display-name");
const meta = document.getElementById("meta");

const statFields = {
  followers: document.getElementById("followers"),
  following: document.getElementById("following"),
  friends: document.getElementById("friends"),
  visits: document.getElementById("visits"),
  games: document.getElementById("games"),
  revenue: document.getElementById("revenue")
};

const POLL_MS = 15000;
let pollTimer;

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Math.round(value || 0));
}

function setStatus(message) {
  statusText.textContent = message;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json();
}

async function resolveUser(username) {
  const payload = {
    usernames: [username],
    excludeBannedUsers: false
  };

  const lookup = await fetchJson("https://users.roproxy.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const user = lookup.data?.[0];
  if (!user?.id) {
    throw new Error("User not found");
  }

  const details = await fetchJson(`https://users.roproxy.com/v1/users/${user.id}`);
  return details;
}

async function fetchAvatar(userId) {
  const thumb = await fetchJson(
    `https://thumbnails.roproxy.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
  );

  return thumb.data?.[0]?.imageUrl;
}

async function fetchCounts(userId) {
  const [followers, following, friends] = await Promise.all([
    fetchJson(`https://friends.roproxy.com/v1/users/${userId}/followers/count`),
    fetchJson(`https://friends.roproxy.com/v1/users/${userId}/followings/count`),
    fetchJson(`https://friends.roproxy.com/v1/users/${userId}/friends/count`)
  ]);

  return {
    followers: followers.count || 0,
    following: following.count || 0,
    friends: friends.count || 0
  };
}

async function fetchGameStats(userId) {
  const gameList = await fetchJson(
    `https://games.roproxy.com/v2/users/${userId}/games?accessFilter=Public&limit=50&sortOrder=Asc`
  );

  const universeIds = (gameList.data || []).map((game) => game.id).filter(Boolean);
  if (universeIds.length === 0) {
    return { activeGames: 0, visits: 0, estimatedRevenue: 0 };
  }

  const gameInfo = await fetchJson(
    `https://games.roproxy.com/v1/games?universeIds=${universeIds.join(",")}`
  );

  const visits = (gameInfo.data || []).reduce((sum, item) => sum + (item.visits || 0), 0);

  return {
    activeGames: universeIds.length,
    visits,
    estimatedRevenue: visits * 0.002
  };
}

function renderStats({ followers, following, friends, visits, activeGames, estimatedRevenue }) {
  statFields.followers.textContent = formatNumber(followers);
  statFields.following.textContent = formatNumber(following);
  statFields.friends.textContent = formatNumber(friends);
  statFields.visits.textContent = formatNumber(visits);
  statFields.games.textContent = formatNumber(activeGames);
  statFields.revenue.textContent = `${formatNumber(estimatedRevenue)} Robux`;
}

async function refreshForUser(user) {
  const [counts, gameStats] = await Promise.all([fetchCounts(user.id), fetchGameStats(user.id)]);
  renderStats({ ...counts, ...gameStats });
}

async function startLiveCounter(username) {
  clearInterval(pollTimer);
  setStatus("Looking up user...");

  const user = await resolveUser(username);
  const avatarUrl = await fetchAvatar(user.id);

  displayName.textContent = `${user.displayName} (@${user.name})`;
  meta.textContent = `ID: ${user.id} • Created: ${new Date(user.created).toLocaleDateString()}`;
  avatar.src = avatarUrl || "";
  profile.classList.remove("hidden");

  setStatus("Loading latest stats...");
  await refreshForUser(user);
  setStatus(`Live updates every ${POLL_MS / 1000} seconds.`);

  pollTimer = setInterval(async () => {
    try {
      await refreshForUser(user);
      setStatus(`Last updated: ${new Date().toLocaleTimeString()}`);
    } catch {
      setStatus("Update failed. Retrying on next poll...");
    }
  }, POLL_MS);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = usernameInput.value.trim();
  if (!username) {
    return;
  }

  try {
    await startLiveCounter(username);
  } catch (error) {
    profile.classList.add("hidden");
    setStatus(error.message || "Could not load this user.");
  }
});
