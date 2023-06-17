
require('dotenv').config();
const chalk = require('chalk')
const screenshot = require('screenshot-desktop');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const { Configuration, OpenAIApi } = require('openai');

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

const weights = {
  "Critical Strike Chance": 9,
  "Critical Strike Damage": 9,
  "Core Skill Damage": 9,
  "Maximum Essence": 8,
  "Damage Reduction (all forms)": 8,
  "Intelligence": 7,
  "Dexterity": 6,
  "Willpower": 6,
  "Strength": 3
}

const prompt = (ocrOutput) => `
I am playing Diablo 4 and these are my characters priority stats by weights in json format

${JSON.stringify(weights)}

the OCR output below is comparing two items. you will have to parse that text to determine what the two items and their stats are. the text does contain + or - on specific stats since it is a comparison.

${ocrOutput}

Taking into account the weighted stats i want and the text given, tell me which item i should equip for the best stats for my character.
`

screenshot().then((img) => {
  // Save the screenshot to a file
  fs.writeFile('screenshot.png', img, (err) => {
    if (err) throw err;

    // Perform OCR on the screenshot
    Tesseract.recognize('screenshot.png', 'eng', { logger: (m) => console.log(m) })
      .then(({ data: { text } }) => {

        console.log('sending this prompt to Chat Completion API: ', prompt(text, weights));

        openai.createChatCompletion({
            model: 'gpt-4-0613',
            messages: [
                {
                    'role': 'system',
                    'content': 'You are an expert ARPG character stat analyzer who is well versed in action rpgs and the importance of stats.'
                },
                {
                    'role': 'user',
                    'content': prompt(text, weights)
                }
            ]
        }).then(completion => {
            if (Array.isArray(completion.data.choices)) {
                return console.log(chalk.green(completion.data.choices[0].message?.content));
            }
            return console.log(completion.data.choices)
        }).catch(err => {
            console.log(err);
        });

        // Delete the screenshot file
        fs.unlink('screenshot.png', (err) => {
          if (err) throw err;
          console.log('Screenshot deleted');
        });
      });
  });
});
