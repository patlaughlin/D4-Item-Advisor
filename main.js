require('dotenv').config();
const { program } = require('commander');
const mustache = require('mustache');
const chalk = require('chalk');
const screenshot = require('screenshot-desktop');
const Tesseract = require('tesseract.js');
const fs = require('fs').promises; // Use promises version of fs
const { Configuration, OpenAIApi } = require('openai');
const { GlobalKeyboardListener } = require("node-global-key-listener");

const v = new GlobalKeyboardListener();
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

program.version('0.0.1');
program.option('-c, --concise', 'concise mode');
program.parse();

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
};

async function main() {
    try {
        const img = await screenshot();
        await fs.writeFile('screenshot.png', img);
        
        const { data: { text } } = await Tesseract.recognize('screenshot.png', 'eng', { logger: m => console.log(m) });
        await fs.unlink('screenshot.png');
        
        const data = {
            ocrOutput: text,
            weights: JSON.stringify(weights),
            concise: program.opts().concise,
            conciseMessage: 'Only provide the name of the item to choose, do not explain your reasoning',
        };

        const template = `
        I am playing Diablo 4 and these are my character's priority stats by weights in JSON format
        {{{weights}}}
        The OCR output below is comparing two items. You will have to parse that text to determine what the two items and their stats are. The text does contain + or - on specific stats since it is a comparison.
        {{{ocrOutput}}}
        Taking into account the weighted stats I want and the text given, tell me which item I should equip for the best stats for my character.
        {{#concise}}
        {{{conciseMessage}}}
        {{/concise}}
        `;
        
        const renderedTemplate = mustache.render(template, data);
        console.log(chalk.green(renderedTemplate));
        
        console.log(chalk.blue('Generating response...'))
        const completion = await openai.createChatCompletion({
            model: 'gpt-4-0613',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert ARPG character stat analyzer who is well versed in action RPGs and the importance of stats.'
                },
                {
                    role: 'user',
                    content: renderedTemplate
                }
            ]
        });
        
        if (Array.isArray(completion.data.choices)) {
            console.log(chalk.green(completion.data.choices[0].message?.content));
        } else {
            console.log(completion.data.choices);
        }
    } catch (err) {
        console.error(err);
    }
}

v.addListener(function (e, down) {
    if (e.state == "DOWN" && e.name == "X" && (down["LEFT CTRL"] || down["RIGHT CTRL"])) {
        main();
    }
});
