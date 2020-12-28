const express = require('express');
const router = express.Router();
const ytdl = require('ytdl-core');
const fs = require('fs');
const readline = require('readline');
const ffmpeg = require('ffmpeg-static');
const cp = require('child_process');

var progressInline = true;
var progressObj = {audio: 0, audioTotal: 0,
				   video: 0, videoTotal: 0,
				   audioEnd:false, videoEnd: false, 
				   uniendo: false};


router.get('/', function(req, res, next) {
  res.render('index', { title: 'Youtube Converter' });
});

router.get('/download', async function(req, res, next) {
	
  	try{
  		let id = ytdl.getURLVideoID(req.query.url); // Obtengo el ID del video
	  	if(ytdl.validateID(id)){  // Me fijo si es un url valido

		  	let info = await ytdl.getInfo(id);
		  	let output = info.player_response.videoDetails.title;
		  	console.log(output.length);
		  	if (output.length > 40) output = output.slice(0, 39);
		  	output = clearComas(output);

		  	console.log(output);

			if(req.query.type == 'both'){      // Descargo audio, video y los uno
				downloadBoth(req.query.url, output + ".mkv");
			}else{
				if(req.query.type == 'audio'){ // Solo audio
					download(req.query.url, output + ".mp3", 'highestaudio');
				}else{						   // Solo video
					download(req.query.url, output + ".mp4", 'highestvideo');
				}
			}
			res.send({ok: true, status: "Downloading..."});
		}else{
			res.send({ok: false, status: "Invalid ID"});
		}
		
	}catch{
		res.send({ok: false, status: "Error"});
	}
  	
});

function download(url, output, qualityValue){
	let stream = ytdl('http://www.youtube.com/watch?v=4EsskV-b-JQ', {quality: qualityValue});

  	// Comienzo la descarga
  	stream.pipe(fs.createWriteStream(output));
  	
  	// Cada vez que se inicia un chunk del video se actualiza el progreso de la descarga
  	stream.on('progress', (chunkLength, downloaded, total) => {
    	
    	if(progressInline){
    		readline.cursorTo(process.stdout, 0, -1);
    		readline.clearScreenDown(process.stdout);
    	}
    	console.log("Donwloaded: " + (Math.floor(100 * downloaded / total)) + "%");    	
  	
  	});

  	// Cuado termina la descarga aviso
  	stream.on('end', () => {
  		console.log("Ready");
  	});
}

// Si el string tiene alguna coma o comilla la remplaza por un espacio
function clearComas(str){  
	while(str.includes("'")){
		str = str.replace("'", " ");
	}
	while(str.includes('"')){
		str = str.replace('"', " ");
	}
	return str;
}

function showProgress(){
	if(progressObj.uniendo){
		readline.cursorTo(process.stdout, 0, -2);
	    console.log("Uniendo..."); 
	}else{
	    let total = progressObj.audioTotal + progressObj.videoTotal;
	    if(total > 0){
	    	let downloaded = progressObj.audio + progressObj.video;
	    	readline.cursorTo(process.stdout, 0, -1);
	    	readline.clearScreenDown(process.stdout);
	    	console.log("Donwloaded: " + (Math.floor(100 * downloaded / total)) + "%"); 
		}
	}
}

function downloadBoth(url, output){

	/* Se fija que el nombre no este ya */
	/*cp.exec("ls ~/Downloads", (error, stdout, stderr) => {
		    if (error) {
		        console.log(`error: ${error.message}`);
		        return;
		    }
		    if (stderr) {
		        console.log(`stderr: ${stderr}`);
		        return;
		    }
		    console.log(`stdout: ${stdout}`);
		});*/

	// Descargo el audio y el video por separado
	let audio = ytdl('http://www.youtube.com/watch?v=4EsskV-b-JQ', {quality: "highestaudio"});
	let video = ytdl('http://www.youtube.com/watch?v=4EsskV-b-JQ', {quality: "highestvideo"});

	// Cargo la info para la barra de progreso de ambas descargas
	audio.on("progress", (chunkLength, downloaded, total) => {
		if(progressObj.audioTotal == 0) progressObj.audioTotal = total;
		progressObj.audio = downloaded;
	});
	audio.on("end", () => {
		progressObj.audioEnd = true;
		if(progressObj.videoEnd) progressObj.uniendo = true;
	});
	video.on("progress", (chunkLength, downloaded, total) => {
		if(progressObj.videoTotal == 0) progressObj.videoTotal = total;
		progressObj.video = downloaded;
	});
	video.on("end", () => {
		progressObj.videoEnd = true;
		if(progressObj.audioEnd) progressObj.uniendo = true;
	});

	// Cada 1 segundo se va a actualisar la barra de progreso
	let progressHandle = setInterval(showProgress, 1000);

	// Lanzo un subproceso que une el audio y el video en un solo archivo
	const ffmpegProcess = cp.spawn(ffmpeg, [
	  // Remove ffmpeg's console spamming
	  '-loglevel', '8', '-hide_banner',
	  // Redirect/Enable progress messages
	  '-progress', 'pipe:3',
	  // Set inputs
	  '-i', 'pipe:4',
	  '-i', 'pipe:5',
	  // Map audio & video from streams
	  '-map', '0:a',
	  '-map', '1:v',
	  // Keep encoding
	  '-c:v', 'copy',
	  // Define output file
	  output,
	], {
	  windowsHide: true,
	  stdio: [
	    // Standard: stdin, stdout, stderr
	    'inherit', 'inherit', 'inherit',
	    // Custom: pipe:3, pipe:4, pipe:5
	    'pipe', 'pipe', 'pipe'
	  ],
	});

	// Cuando termina detengo la barra de progreso
	ffmpegProcess.on('close', () => {
	  console.log('Done');
	  clearInterval(progressHandle);
	});

	ffmpegProcess.stdio[3].on('data', chunk => {});

	// Los datos de entrada del subprocesos son el video y el audio descargados
	audio.pipe(ffmpegProcess.stdio[4]);
	video.pipe(ffmpegProcess.stdio[5]);
}

module.exports = router;





