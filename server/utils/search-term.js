function escapeLikeTerm(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "''")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

module.exports = {
  escapeLikeTerm,
};
