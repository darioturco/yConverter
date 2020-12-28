var url, type;

setTimeout(() => {
	url = document.getElementById("urlInput");
	type = document.getElementById("optionInput");
}, 0);

async function sendConvert(){
	let urlText = url.value;
	let typeText = type.value;
	let obj = await fetch("./download?url=" + urlText + "&type=" + typeText);
	let objRes = await obj.json();
	console.log(objRes);
}
