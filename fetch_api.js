fetch('http://localhost:3000/api/channels?type=long_form')
  .then(r => r.json())
  .then(d => {
    const ch = d.channels.find(c => c.channelName === 'StrikeTheory');
    console.log('StrikeTheory videos length:', ch ? ch.videos.length : 'not found');
  })
  .catch(console.error);
