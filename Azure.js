console.log("Azure init");
var SpeechSDK;
var authorizationToken = "";
var serviceRegion = "eastasia";

var micPermission = false;

//stt
var recognizer;

//tts
var synthesizer;
var player;

//replace me
let authorizationEndpoint = "http://localhost:3000/api/get-speech-token";

async function RequestAuthorizationToken() {
	if (authorizationEndpoint) {
		try {
			console.log("axios get A");
			const res = await axios.get(authorizationEndpoint);
			console.log("axios get B");
			const token = res.data.token;
			//const region = res.data.region;
			//regionOptions.value = region;
			authorizationToken = token;

			console.log('Token fetched from back-end: ' + token);
		} catch (err) {
			console.log("request token " + err);
		}
	}
}

function RequestMic() {
	navigator.mediaDevices.getUserMedia({ audio: true })
		.then(function (stream) {
			console.log('You let me use your mic!')
			micPermission = true;
		})
		.catch(function (err) {
			console.log('No mic for you!')
			micPermission = false;
		});
}

function GetMicrophonePermission() {
	return micPermission;
}

async function StartSpeechToText(token, speechRecognitionLanguage) {
	console.log("Azure StartSpeechToText 1");
	if (token != null)
		authorizationToken = token;
	else
		await RequestAuthorizationToken();

	console.log("Azure StartSpeechToText 2 ");
	SpeechSDK = window.SpeechSDK;

	if (SpeechSDK == null) {
		window.console.log("StartSpeechToText err " + "SpeechSDK is null");
		unityInstance.SendMessage("AzureManager", "OnRecieveResult_SpeechToText", "error");
		return;
	}

	var speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(authorizationToken, serviceRegion);
	if (speechRecognitionLanguage != "")
		speechConfig.speechRecognitionLanguage = speechRecognitionLanguage;
	else
		speechConfig.speechRecognitionLanguage = "en-GB"; // zh-HK en-GB en-US
	var audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
	recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

	// recognizer.recognizeOnceAsync( // listening for silence at the end or until a maximum of 15 seconds
	// 	function (result) {
	// 		// startRecognizeOnceAsyncButton.disabled = false;
	// 		// phraseDiv.innerHTML += result.text;
	// 		window.console.log("StartSpeechToText " + result);
	// 		if (result.text !== undefined)
	// 			unityInstance.SendMessage("AzureManager", "OnRecieveResult_SpeechToText", result.text);
	// 		else
	// 			unityInstance.SendMessage("AzureManager", "OnRecieveResult_SpeechToText", "error");
	// 		recognizer.close();
	// 		recognizer = undefined;
	// 	},
	// 	function (err) {
	// 		// startRecognizeOnceAsyncButton.disabled = false;
	// 		// phraseDiv.innerHTML += err;
	// 		window.console.log("StartSpeechToText err " + err);
	// 		unityInstance.SendMessage("AzureManager", "OnRecieveResult_SpeechToText", "error");
	// 		recognizer.close();
	// 		recognizer = undefined;
	// 	});

	recognizer.speechEndDetected = function (s, e) {
		window.console.log("speechEndDetected");
		window.console.log(e.result.text);
		//SendSpeechResult();
		recognizer.close();
		recognizer = undefined;
	}
	recognizer.recognized = function (s, e) {
		window.console.log("recognized");
		window.console.log(e.result.text);
		speechResult = e.result.text;
		SendSpeechResult();
		recognizer.stopContinuousRecognitionAsync(
			function () {
				window.console.log("stopContinuousRecognitionAsync 1");
			},
			function (err) {
				window.console.log("stopContinuousRecognitionAsync 2");
				window.console.log(err);
			}
		);
	}
	recognizer.startContinuousRecognitionAsync(
		function () {
			window.console.log("startContinuousRecognitionAsync");
			speechResult = "error";
		},
		function (err) {
			window.console.log("StartSpeechToText err " + err);
			speechResult = "error";
			SendSpeechResult();
			recognizer.close();
			recognizer = undefined;
		});


}

function StopSpeechToText() {
	if (recognizer != null) {
		recognizer.close();
		recognizer = undefined;
	}
}

function SendSpeechResult() {
	window.console.log("SendSpeechResult  " + speechResult);
	unityInstance.SendMessage("AzureManager", "OnRecieveResult_SpeechToText", speechResult);
}

var speechResult = "error";

function GetAudioCurrentTime() {
	if (player !== undefined) {
		//console.log(player.currentTime);
		return player.currentTime;
	}
	else
		return 0;
}

async function StartTextToSpeech(token, speechString, speechSynthesisLanguage, speechSynthesisVoiceName) {
	console.log("Azure StartTextToSpeech " + speechString);
	if (token != null)
		authorizationToken = token;
	else
		await RequestAuthorizationToken();
	SpeechSDK = window.SpeechSDK;

	var speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(authorizationToken, serviceRegion);

	if (speechSynthesisLanguage != "")
		speechConfig.speechSynthesisLanguage = speechSynthesisLanguage;
	else
		speechConfig.speechSynthesisLanguage = "en-GB"; // en-GB en-US
	if (speechSynthesisVoiceName != "")
		speechConfig.speechSynthesisVoiceName = speechSynthesisVoiceName;
	else
		speechConfig.speechSynthesisVoiceName = "en-GB-EthanNeural"; // zh-HK-WanLungNeural en-GB-EthanNeural https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts


	player = new SpeechSDK.SpeakerAudioDestination();
	player.onAudioStart = function (_) {
		window.console.log("playback started");
		unityInstance.SendMessage("AzureManager", "OnAudioStart");
	}
	player.onAudioEnd = function (_) {
		window.console.log("playback finished");
		unityInstance.SendMessage("AzureManager", "OnAudioEnd");
	};
	var audioConfig = SpeechSDK.AudioConfig.fromSpeakerOutput(player);

	synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, audioConfig);

	synthesizer.wordBoundary = function (s, e) {
		window.console.log(e);
		window.console.log(e.text + " " + e.audioOffset/10000000 + " " + e.duration/10000000);
		var json = { audioOffset: e.audioOffset + e.duration, wordLength: parseInt(e.wordLength), text: e.text };
		unityInstance.SendMessage("AzureManager", "OnWordBoundary", JSON.stringify(json));
	}

	synthesizer.visemeReceived = function (s, e) {
		window.console.log(e);
		window.console.log(e.audioOffset/10000000);
		//eventsDiv.innerHTML += "(Viseme), Audio offset: " + e.audioOffset / 10000 + "ms. Viseme ID: " + e.visemeId + '\n';
		var json = { audioOffset: e.audioOffset, visemeId: e.visemeId };
		unityInstance.SendMessage("AzureManager", "OnVisemeReceived", JSON.stringify(json));
	}

	synthesizer.speakTextAsync(
		speechString,
		function (result) {
			//   startSpeakTextAsyncButton.disabled = false;
			//   if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
			// 	resultDiv.innerHTML += "synthesis finished for [" + inputText + "].\n";
			//   } else if (result.reason === SpeechSDK.ResultReason.Canceled) {
			// 	resultDiv.innerHTML += "synthesis failed. Error detail: " + result.errorDetails + "\n";
			//   }
			window.console.log("speak result " + result);
			var s = result.text;
			window.console.log("s " + s);
			unityInstance.SendMessage("AzureManager", "OnRecieveResult_TextToSpeech", "Success");
			synthesizer.close();
			synthesizer = undefined;
		},
		function (err) {
			//   startSpeakTextAsyncButton.disabled = false;
			//   resultDiv.innerHTML += "Error: ";
			//   resultDiv.innerHTML += err;
			//   resultDiv.innerHTML += "\n";
			window.console.log("speak 2 result " + err);
			unityInstance.SendMessage("AzureManager", "OnRecieveResult_TextToSpeech", "Error");
			synthesizer.close();
			synthesizer = undefined;
		});
}

function StopTextToSpeech() {
	unityInstance.SendMessage("AzureManager", "OnAudioEnd");
	if (player != null)
		player.pause();
	if (synthesizer != null) {
		synthesizer.close();
		synthesizer = undefined;
	}
}
