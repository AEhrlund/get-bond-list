'use strict'
const fs = require('fs')
const https = require('https')
const AEHAvanza = require('aeh-avanza')
const credentials = require('aeh-credentials')

const MAX_PRICE = 100000
const allBondsFile = './all-bonds.js'
const shortlistBondsFile = `./${MAX_PRICE}-bonds.js`
var shortlistBonds = require(allBondsFile)
if (fs.existsSync(shortlistBondsFile)) {
    shortlistBonds = require(shortlistBondsFile)
}

const avanza = new AEHAvanza()
const configFolder = process.env.OneDrive + '\\Dev\\Projekt\\_konfiguration\\'
const credentialsFile = configFolder + 'avanza_credentials'

process.on('unhandledRejection', function (err) {
    console.log(err)
})

async function getOptionsPage(page) {
    return new Promise((resolve, reject) => {
        const pageUrl = `https://www.avanza.se/obligationer.html?name=&selectedInstrumentTypes=BOND&page=${page}&sortField=NAME&sortOrder=ASCENDING`
        var request = https.get(pageUrl, (res) => {
            let data = ''
            res.on('data', (chunk) => {
                data += chunk;
            })
            res.on('end', () => {
                resolve(data)
            })
        })
        request.on('error', (e) => {
            reject(e)
        })
    })
}

async function getAllBonds() {
    var ids = []
    var done = false
    for (var page = 1; !done; page += 1) {
        var data = await getOptionsPage(page.toString())
        var splits = data.split('/obligationer/om-obligationen.html/')
        process.stdout.write('.')
        if (splits.length <= 1) {
            done = true
        }
        else {
            await splits.forEach((element, index) => {
                if (index > 0) {
                    var id = element.substring(0, element.indexOf('/'))
                    var title = element.substring(element.indexOf('title="'))
                    title = title.substring(title.indexOf('"') + 1)
                    title = title.substring(0, title.indexOf('"'))
                    ids.push({ id, title })
                }
            })
        }
    }
    return ids
}

function writeBondsToFile(file, bonds) {
    var bondsStr = `module.exports = bonds = ${JSON.stringify(bonds, null, 4)}`
    fs.writeFileSync(file, bondsStr)
}

function getEncCredentials() {
    return fs.readFileSync(credentialsFile, 'utf8')
}

async function getPassword() {
    var password = null
    if (process.argv.length >= 3) {
        password = process.argv[3]
    }
    else {
        password = await credentials.promptForPassword()
    }
    return password
}

async function getCredentials() {
    const password = await getPassword()
    var creds = credentials.decryptCredentials(password, getEncCredentials())
    creds.password = password
    return creds
}

function bondForSale(bond) {
    if (bond.sellPrice != undefined) {
        return true
    }
    return false
}

async function getFilteredBonds(creds) {
    await avanza.authenticate(creds)
    var filteredBonds = []
    var bonds = []
    for (var i = 0; i < shortlistBonds.length; i++) {
        console.log('')
        console.log(`Getting info about ${shortlistBonds[i].title} (${shortlistBonds[i].id})`)
        const bond = await avanza.getBond(shortlistBonds[i].id)
        console.log(`Filter ${bond.name}: ${bond.tradingUnit}`)
        if (bond.tradingUnit <= MAX_PRICE) {
            bonds.push({ id: bond.id, title: bond.name })
            if (bond.tradable == true && bondForSale(bond)) {
                console.log(`Added ${bond.name}`)
                filteredBonds.push(bond)
            }
        }
    }
    writeBondsToFile(shortlistBondsFile, bonds)
    return filteredBonds
}

async function updateAllBondsFile() {
    const bondIds = await getAllBonds()
    writeBondsToFile(allBondsFile, bondIds)
}

async function getBondsList() {
    const creds = await getCredentials()
    const filteredBonds = await getFilteredBonds(creds)
    console.log(filteredBonds)
}

if (process.argv[2] == 'update') {
    updateAllBondsFile()
}
else if (process.argv[2] == 'get') {
    getBondsList()
}
