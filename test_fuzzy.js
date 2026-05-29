function editDistance(a, b) {
  const m = a.length, n2 = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n2 + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n2; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n2; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n2];
}

function fuzzyMatchWords(needle, haystack) {
  const nWords = needle.toLowerCase().split(/\s+/);
  const hWords = haystack.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
  return nWords.every(nWord =>
    nWord.length < 3 ||
    hWords.some(hWord => editDistance(nWord, hWord) <= Math.max(1, Math.floor(hWord.length / 3)))
  );
}

console.log('editDistance(rosseta, rosetta):', editDistance('rosseta', 'rosetta'));
console.log('editDistance(rosseta, rossett):', editDistance('rosseta', 'rossett'));
console.log('editDistance(rosseta, roseta):', editDistance('rosseta', 'roseta'));
console.log('fuzzyMatchWords("rosseta", "rosetta"):', fuzzyMatchWords('rosseta', 'rosetta'));
console.log('fuzzyMatchWords("what is rosseta", "What is Rosetta?"):', fuzzyMatchWords('what is rosseta', 'What is Rosetta?'));
console.log('fuzzyMatchWords("what is vins", "What is VINS?"):', fuzzyMatchWords('what is vins', 'What is VINS?'));

// Also test: what threshold would allow rosseta -> rosetta
const threshold = Math.max(1, Math.floor('rosetta'.length / 3));
console.log('threshold for rosetta (len=7):', threshold, 'allow dist<=', threshold);