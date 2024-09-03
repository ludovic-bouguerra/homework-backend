import * as functions from "firebase-functions";
import express, {Request, Response} from "express";
import bodyParser from "body-parser";
import OpenAI from "openai";
import { createHash } from 'node:crypto'

import { defineString } from "firebase-functions/params";
const {
    info,
  } = require("firebase-functions/logger");
const cors = require('cors')

const apiKey = defineString('OPENAI_API_KEY');

function sha512(content: string) {  
    return createHash('sha512').update(content).digest('hex')
}

const app = express();
app.use(cors())

app.use(bodyParser.json({limit: '30mb'}));
app.use(bodyParser.urlencoded({limit: '30mb', extended: true}));


// Endpoint pour recevoir l'image
app.post('/analyze', async (req: Request, res: Response) => {
    info("Request received");
    const { image, language } = req.body;

    const client = new OpenAI({
        apiKey: apiKey.value(),
      });

    try {
        info("Analyse prompt, from mobile app query");
        const base64Image = image
        // Appeler l'API de ChatGPT (ou autre modèle) ici
        info("Analyse token and auth");
        const userID = req.get('x-user-id');
        const authorization = req.get('authorization');
        info(userID);
        info(authorization);
        if (!userID && !authorization && authorization?.split(" ")[0] !== "Bearer") {
            res.status(400).json({ error: 'Request is incomplete' });
            return;
        }

        info("Verify Authenticated User");
        let token = (authorization as String).split(" ")[1];
        const toCompare = `com.kalyzee.apps.HomeworksHelper${userID}`;
        info("language " + language);
        
 

        if (sha512(toCompare) !== token) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        let languageStr = "Anglais";
        if (language.includes('-')) {
            languageStr = language.toLowerCase().split("-")[0];
            if (languageStr === "fr") {
                languageStr = "Français";
            }
        }
        


        
        const params = {
            messages: [
                    { role: 'system', content: `
                        Je travaille actuellement sur un exercice et j’ai un scan de l’énoncé que je souhaite te soumettre pour résolution.
                        Tu dois répondre en langue : ${languageStr}.
                        Les équations et formules mathématiques doit être écrites en LateX.
                        Si le scan fourni n'est pas suffisamment lisible (flou ou mal cadré), ou ne contient pas un énoncé d'exercice, tu dois le signaler et m'inviter à réeffectuer le scan ou te faire parvenir une autre image de l'énoncé.
                        Structure de la réponse attendue :
                        Solution : Fournir la réponse exacte ainsi que le raisonnement détaillé s'il s'agit d'un exercice de science.
                        Explication : Donner une explication concise (environ 4 lignes) de la méthode employée pour déterminer l’ordre des étapes. Adapte le niveau de langage au niveau scolaire de l’exercice.
                        `},
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image_url',
                                "image_url": {
                                    "url": "data:image/jpeg;base64,"+base64Image
                                }                            
                            },
                        ],
                    }
            ],
            model:"gpt-4o-mini",
          };
        
        const chatCompletion= await client.chat.completions.create(params as any);
        info("Resquest sent");
        
        const gptResponse = chatCompletion.choices[0].message.content;
        
        
        
        res.json({ message: gptResponse });

    } catch (error : any) {
        info(error);
        res.status(500).json({ error: 'Erreur lors du traitement de l\'image' });
    }
});



exports.app = functions.https.onRequest(app);

