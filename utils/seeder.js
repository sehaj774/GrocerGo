const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs').promises;
const path = require('path');

// Load env vars
dotenv.config({ path: './.env' });

// Load models
const Product = require('../models/Product');
const Brand = require('../models/Brand');
// Note: We don't need a Category model if it's static, but let's keep it simple for now.

const runSeeder = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected for Seeder...');

        if (process.argv[2] === '-i') {
            await importData();
        } else if (process.argv[2] === '-d') {
            await deleteData();
        } else {
            console.log('Please provide an import (-i) or delete (-d) flag.');
        }

    } catch (err) {
        console.error(`Seeder Error: ${err.message}`);
    } finally {
        await mongoose.disconnect();
        console.log('MongoDB Disconnected.');
        process.exit();
    }
};

const readData = async (fileName) => {
    const filePath = path.join(__dirname, '..', 'data', fileName); // Corrected path to _data
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
};

const importData = async () => {
    try {
        console.log('Reading data from JSON files...');
        const productsJSON = await readData('products.json');
        const brandsJSON = await readData('brands.json');

        console.log('Deleting existing data...');
        await Product.deleteMany();
        await Brand.deleteMany();
        console.log('Existing data deleted.');

        console.log('Importing brands...');
        const createdBrands = await Brand.insertMany(brandsJSON);
        console.log(`${createdBrands.length} Brands Imported!`);

        // Create a map of brand names to their new database IDs for easy lookup
        const brandMap = createdBrands.reduce((map, brand) => {
            map[brand.name] = brand._id;
            return map;
        }, {});

        // Prepare products with the correct brand ObjectId
        const productsToImport = productsJSON.map(product => {
            return {
                ...product,
                brand: brandMap[product.brand] // Replace the brand name string with the ObjectId
            };
        });

        console.log('Importing products with brand relationships...');
        await Product.insertMany(productsToImport);
        console.log('Products Imported!');
        
    } catch (err) {
        console.error(`Import Error: ${err}`);
    }
};

const deleteData = async () => {
    try {
        console.log('Deleting all products and brands...');
        await Product.deleteMany();
        await Brand.deleteMany();
        console.log('Data Destroyed!');
    } catch (err) {
        console.error(`Deletion Error: ${err}`);
    }
};

runSeeder();