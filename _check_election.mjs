(async () => {
  const res = await fetch("https://api.hypixel.net/v2/resources/skyblock/election");
  const data = await res.json();
  console.log(Object.keys(data));
  console.log("has election", !!data.election);
  console.log("has current", !!data.current);
  console.log("election candidates", data.election?.candidates?.length);
})();
