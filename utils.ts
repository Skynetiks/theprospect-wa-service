export function findAllValuesByKey(obj: any, key: string): any[] {
	const values: any[] = [];

	function recursiveSearch(obj: any): void {
		if (typeof obj !== "object" || obj === null) {
			return;
		}

		if (key in obj) {
			values.push(obj[key]);
		}

		for (const k in obj) {
			if (obj.hasOwnProperty(k)) {
				recursiveSearch(obj[k]);
			}
		}
	}

	recursiveSearch(obj);
	return values;
}

export function unixToDateTime(unixTimestamp: number) {
	// Multiply by 1000 to convert seconds to milliseconds
	const date = new Date(unixTimestamp * 1000);
	return date;
}

export function makeId(length: number) {
	let result = "";
	const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	const charactersLength = characters.length;
	let counter = 0;
	while (counter < length) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
		counter += 1;
	}
	return result;
}
