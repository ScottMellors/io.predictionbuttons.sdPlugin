async function refreshAccessToken(refreshToken) {
    return await fetch(`http://localhost:3000/streamdeck-auth-refresh/${refreshToken}`,).then(async (response) => {
        switch (response.status) {
            case 200:
                return response.json();
            case 404:
                throw new Error("404 - Param not found");
            default:
                throw new Error("Got other error - " + response.status);

        }

    }).then(json => {
        return json.accessToken;
    }).catch((exc) => {
        console.log(exc);
        return undefined;
    });
}