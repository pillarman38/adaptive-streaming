let voteSession = {
  active: false,
  phase: "idle",
  hostClientId: null,
  submissions: {},
};

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

function buildVoteStatePayload(clients) {
  const connectedIds = getConnectedDisplayClientIds(clients);
  const finishedClientIds = connectedIds.filter(
    (id) => voteSession.submissions[id] !== undefined
  );
  const pendingCount = connectedIds.length - finishedClientIds.length;

  let votedMovieKeys = [];
  if (voteSession.phase === "revealed") {
    const keySet = new Set();
    Object.values(voteSession.submissions).forEach((keys) => {
      (keys || []).forEach((key) => keySet.add(String(key)));
    });
    votedMovieKeys = [...keySet];
  }

  return {
    type: "voteState",
    active: voteSession.active,
    phase: voteSession.phase,
    hostClientId: voteSession.hostClientId,
    connectedCount: connectedIds.length,
    finishedCount: finishedClientIds.length,
    pendingCount,
    finishedClientIds,
    votedMovieKeys,
  };
}

function maybeReveal(clients) {
  if (voteSession.phase !== "collecting") {
    return;
  }

  const connectedIds = getConnectedDisplayClientIds(clients);
  if (connectedIds.length === 0) {
    return;
  }

  const allFinished = connectedIds.every(
    (id) => voteSession.submissions[id] !== undefined
  );

  if (allFinished) {
    voteSession.phase = "revealed";
  }
}

function resetVoteSession() {
  voteSession.active = false;
  voteSession.phase = "idle";
  voteSession.hostClientId = null;
  voteSession.submissions = {};
}

function broadcastVoteState(clients, broadcastToDisplays) {
  broadcastToDisplays(buildVoteStatePayload(clients));
}

function sendVoteStateToConnection(connection, clients) {
  if (connection.readyState === 1) {
    connection.send(JSON.stringify(buildVoteStatePayload(clients)));
  }
}

function handleVoteMessage(message, connection, clients, broadcastToDisplays) {
  const clientId = message.clientId || connection.clientId;
  if (!clientId) {
    return false;
  }

  if (message.type === "voteEnable") {
    if (voteSession.phase !== "idle") {
      broadcastVoteState(clients, broadcastToDisplays);
      return true;
    }

    voteSession.active = true;
    voteSession.phase = "collecting";
    voteSession.hostClientId = clientId;
    voteSession.submissions = {};
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

    const movieKeys = Array.isArray(message.movieKeys)
      ? message.movieKeys.map((key) => String(key))
      : [];
    voteSession.submissions[clientId] = movieKeys;
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