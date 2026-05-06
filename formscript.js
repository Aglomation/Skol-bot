const VERCEL_API_URL = "https://verifyproxybotthing.vercel.app/api/send";
const SECRET_KEY = "0bBNOhhPUz4X3bXR8k8xsx2uPEgK"; // I love plaintext api keys

function _onSubmit(e) {
	const response = e.response;
	const itemResponses = response.getItemResponses();

	let email = response.getRespondentEmail();
	let kodValue = "";

	for (let i = 0; i < itemResponses.length; i++) {
		const title = itemResponses[i].getItem().getTitle();
		const answer = itemResponses[i].getResponse();
		if (title.toLowerCase() === "kod") kodValue = answer;
		if (!email && title.toLowerCase() === "email") email = answer;
	}

	const payload = {
		content: `${email || "Error"}$$${kodValue || "Error"}`,
	};

	const options = {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": SECRET_KEY,
		},
		payload: JSON.stringify(payload),
		muteHttpExceptions: true,
	};

	const res = UrlFetchApp.fetch(VERCEL_API_URL, options);
	console.log(res.getContentText());
}
