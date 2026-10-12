// api/encrypted-key.js
// Serves encrypted JFR key without authentication
// (Safe because the key is already encrypted)

const ENCRYPTED_JFR_KEY = {
    "iv": "a4EroL5JUEgVloj1",
    "salt": "PtvozUTEvgxEqQUpQY3yyA==",
    "ciphertext": "ne2yiSgFCpDpDbjMmcW4wlNoFo2ogXbhH2sPHFup9SvlfRpay7PtKJnq1SJLdg2Pt9NHtDwf/+vncciJoKhzmxW53NuQA6X+BrTtXAhlMTI="
};

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET', 'OPTIONS']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        // Return encrypted key (no auth needed, it's encrypted)
        return res.status(200).json({
            success: true,
            jfrKey: ENCRYPTED_JFR_KEY
        });
    } catch (error) {
        console.error('Error fetching encrypted key:', error);
        return res.status(500).json({ error: error.message });
    }
}
