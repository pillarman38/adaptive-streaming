const HOST_CODE = "4548";

let voteSession = {
  active: false,
  phase: "idle",
  hostClientId: null,
  submissions: {},
  participants: {},
  eligibleMovieKeys: null,
  round: 0,
  remainingMovieKeys: null,
};

function getRevealedMovieKeys() {
  const keySet = new Set();
  Object.values(voteSession.submissions).forEach((keys) => {
    (keys || []).forEach((key) => keySet.add(String(key)));
  });
  return [...keySet];
}

function computeVoteCounts() {
  const counts = {};
  Object.values(voteSession.submissions).forEach((keys) => {
    (keys || []).forEach((key) => {
      const movieKey = String(key);
      counts[movieKey] = (counts[movieKey] || 0) + 1;
    });
  });
  return counts;
}

function getConnectedDisplayClientIds(clients) {
  const ids = new Set();
  clients.forEach((client) => {
    if (
      client.readyState === 1 &&
      client.clientRole === "display" &&
      client.clientId
    ) {
      ids.add(client.clientId);
    }
  });
  return [...ids];
}

function getParticipatingClientIds(clients) {
  return getConnectedDisplayClientIds(clients).filter(
    (id) => voteSession.participants[id] === true
  );
}

function buildVoteStatePayload(clients) {
  const connectedIds = getConnectedDisplayClientIds(clients);
  const participatingIds = getParticipatingClientIds(clients);
  const finishedClientIds = participatingIds.filter(
    (id) => voteSession.submissions[id] !== undefined
  );
  const pendingCount = participatingIds.length - finishedClientIds.length;

  let votedMovieKeys = [];
  let voteCounts = {};
  if (voteSession.phase === "revealed") {
    votedMovieKeys =
      voteSession.remainingMovieKeys || getRevealedMovieKeys();
    voteCounts = computeVoteCounts();
  }

  return {
    type: "voteState",
    active: voteSession.active,
    phase: voteSession.phase,
    hostClientId: voteSession.hostClientId,
    connectedCount: participatingIds.length,
    finishedCount: finishedClientIds.length,
    pendingCount,
    finishedClientIds,
    votedMovieKeys,
    voteCounts,
    eligibleMovieKeys: voteSession.eligibleMovieKeys || [],
    round: voteSession.round,
    participatingClientIds: participatingIds,
  };
}

function maybeReveal(clients) {
  if (voteSession.phase !== "collecting") {
    return;
  }

  const participatingIds = getParticipatingClientIds(clients);
  if (participatingIds.length === 0) {
    return;
  }

  const allFinished = participatingIds.every(
    (id) => voteSession.submissions[id] !== undefined
  );

  if (allFinished) {
    voteSession.phase = "revealed";
    voteSession.remainingMovieKeys = getRevealedMovieKeys();
  }
}

function resetVoteSession() {
  voteSession.active = false;
  voteSession.phase = "idle";
  voteSession.hostClientId = null;
  voteSession.submissions = {};
  voteSession.eligibleMovieKeys = null;
  voteSession.round = 0;
  voteSession.remainingMovieKeys = null;
}

function broadcastVoteState(clients, broadcastToDisplays) {
  broadcastToDisplays(buildVoteStatePayload(clients));
}

function sendVoteStateToConnection(connection, clients) {
  if (connection.readyState === 1) {
    connection.send(JSON.stringify(buildVoteStatePayload(clients)));
  }
}

function sendToConnection(connection, message) {
  if (connection.readyState === 1) {
    connection.send(JSON.stringify(message));
  }
}

function handleVoteMessage(message, connection, clients, broadcastToDisplays) {
  const clientId = message.clientId || connection.clientId;
  if (!clientId) {
    return false;
  }

  if (message.type === "voteParticipation") {
    voteSession.participants[clientId] = !!message.participating;
    broadcastVoteState(clients, broadcastToDisplays);
    return true;
  }

  if (message.type === "voteEnable") {
    if (voteSession.phase !== "idle") {
      broadcastVoteState(clients, broadcastToDisplays);
      return true;
    }

    if (String(message.hostCode || "") !== HOST_CODE) {
      sendToConnection(connection, {
        type: "voteHostRejected",
        reason: "invalid_code",
      });
      return true;
    }

    // Valid host code: treat this client as a participating host.
    voteSession.participants[clientId] = true;
    voteSession.active = true;
    voteSession.phase = "collecting";
    voteSession.hostClientId = clientId;
    voteSession.submissions = {};
    voteSession.eligibleMovieKeys = null;
    voteSession.round = 1;
    broadcastVoteState(clients, broadcastToDisplays);
    return true;
  }

  if (message.type === "voteNextRound") {
    if (clientId !== voteSession.hostClientId) {
      return true;
    }

    if (voteSession.phase !== "revealed") {
      broadcastVoteState(clients, broadcastToDisplays);
      return true;
    }

    const remainingMovies =
      voteSession.remainingMovieKeys || getRevealedMovieKeys();
    if (remainingMovies.length <= 1) {
      broadcastVoteState(clients, broadcastToDisplays);
      return true;
    }

    voteSession.eligibleMovieKeys = remainingMovies;
    voteSession.submissions = {};
    voteSession.remainingMovieKeys = null;
    voteSession.phase = "collecting";
    voteSession.round += 1;
    broadcastVoteState(clients, broadcastToDisplays);
    return true;
  }

  if (message.type === "voteKnockOff") {
    if (clientId !== voteSession.hostClientId) {
      return true;
    }

    if (voteSession.phase !== "revealed") {
      broadcastVoteState(clients, broadcastToDisplays);
      return true;
    }

    const movieKey = String(message.movieKey || "");
    if (!movieKey || !Array.isArray(voteSession.remainingMovieKeys)) {
      broadcastVoteState(clients, broadcastToDisplays);
      return true;
    }

    if (voteSession.remainingMovieKeys.length <= 1) {
      broadcastVoteState(clients, broadcastToDisplays);
      return true;
    }

    if (!voteSession.remainingMovieKeys.includes(movieKey)) {
      broadcastVoteState(clients, broadcastToDisplays);
      return true;
    }

    voteSession.remainingMovieKeys = voteSession.remainingMovieKeys.filter(
      (key) => key !== movieKey
    );
    broadcastVoteState(clients, broadcastToDisplays);
    return true;
  }

  if (message.type === "voteDisable") {
    if (clientId !== voteSession.hostClientId) {
      return true;
    }

    resetVoteSession();
    broadcastVoteState(clients, broadcastToDisplays);
    return true;
  }

  if (message.type === "voteFinish") {
    if (voteSession.phase !== "collecting") {
      broadcastVoteState(clients, broadcastToDisplays);
      return true;
    }

    if (voteSession.participants[clientId] !== true) {
      broadcastVoteState(clients, broadcastToDisplays);
      return true;
    }

    const movieKeys = Array.isArray(message.movieKeys)
      ? message.movieKeys.map((key) => String(key))
      : [];
    let filteredKeys = movieKeys;
    if (
      Array.isArray(voteSession.eligibleMovieKeys) &&
      voteSession.eligibleMovieKeys.length > 0
    ) {
      const eligible = new Set(voteSession.eligibleMovieKeys);
      filteredKeys = movieKeys.filter((key) => eligible.has(key));
    }
    voteSession.submissions[clientId] = filteredKeys;
    maybeReveal(clients);
    broadcastVoteState(clients, broadcastToDisplays);
    return true;
  }

  return false;
}

function onClientDisconnect(connection, clients, broadcastToDisplays) {
  if (voteSession.phase === "collecting") {
    maybeReveal(clients);
    broadcastVoteState(clients, broadcastToDisplays);
  }
}

module.exports = {
  voteSession,
  resetVoteSession,
  buildVoteStatePayload,
  broadcastVoteState,
  sendVoteStateToConnection,
  handleVoteMessage,
  onClientDisconnect,
};
