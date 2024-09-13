const express = require("express");
const {Pool} = require("pg");
const cors = require('cors');
const path = require('path'); 
const jwt= require("jsonwebtoken")
const app = express();
const port =3000;
//enable cors
app.use(cors());
//postgres configuration
const db_cnx = new Pool ({
    user:"postgres",
    host:"localhost",
    database :"mydb",
    password: 'admin',
    port: 5432,    
});
//test DB connection :
db_cnx.connect((err,client)=>{
    if(err){
        return console.error('error in acquiring client',err.stack);
    }
    client.query('SELECT NOW()', (err, result) => {
        
        if (err) {
            return console.error('Error executing query', err.stack);
        }
        console.log(result.rows);
    });
});
// Express route
app.get('/', (req, res) => {
    res.send('Hello to my app');
});
// Route to get all users
app.get('/categories', async (req, res) => {
    try {
        const result = await db_cnx.query('SELECT * FROM public."Listes_de_catégories"');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

const bodyParser = require('body-parser');

const multer = require('multer');
const fs = require('fs');
const upload = multer({ dest: 'uploads/' });
app.use(cors());
app.use(bodyParser.json());

app.post('/upload-et-ajouter', upload.array('images'), async (req, res) => {
    const parentDir = path.join('C:', 'Users', 'Public', 'upload');
    const { category, description } = req.body;
    console.log(category);
    console.log(description);
    try {
      // Create a new directory named "ticket X" where X is the next incremented number
      const existingDirs = fs.readdirSync(parentDir).filter(name => fs.lstatSync(path.join(parentDir, name)).isDirectory());
      console.log(`Ticket number is: ${existingDirs}`);
      const newTicketNumber = existingDirs.length + 1;
      console.log(`Ticket number is: ${newTicketNumber}`);
      const targetDir = path.join(parentDir, `ticket ${newTicketNumber}`);
      console.log(`Target path  is: ${targetDir}`);
      const targetDirName = `ticket ${newTicketNumber}`;
      // Create the new "ticket X" directory
      fs.mkdirSync(targetDir);
  
      const client = await db_cnx.connect();
  
      req.files.forEach((file, index) => {
        const tempPath = file.path;
        const targetPath = path.join(targetDir, `image_${index + 1}${path.extname(file.originalname)}`);
  
        // Move the file to the "ticket X" directory
        fs.renameSync(tempPath, targetPath);  
      });
      target_path=path.join(parentDir,targetDirName)
      // Insert the record into the database with the path to the image in the new directory
      db_cnx.query('INSERT INTO public."Tickets" (id_categorie, description, lien_image) VALUES ($1, $2, $3)', [category, description, target_path]);
      res.status(200).send(`Files uploaded and ticket added successfully to directory ${newTicketNumber}`);
    } catch (err) {
      console.error(err);
      res.status(500).send('An error occurred while uploading the files and adding the ticket. Please try again.');
    }
  });
//admin login
app.post('/admin-users',async(req,res)=>{
    try {
        const {username,password}=req.body;
        const user=await db_cnx.query('SELECT * FROM public."users" WHERE username=$1 and password=$2;',[username,password])
        if(user.rows.length>0)
            {
        let payload={ subject: username }
        let token = jwt.sign(payload,'Secretkey')
        res.status(200).send({token})
             }
        else{
            res.status(401).send('Invalid username or password')
            }
        }
    catch(err){
        console.error(err);
        res.status(500).send('Internal Server Error');   
    }
     
});
//api to count the number of tickets
app.get('/count-tickets',async(req,res)=>{
    try{
        
        const result = await db_cnx.query('SELECT count(id),id_etat FROM public."Tickets" group by id_etat;');
        res.json(result.rows);
    }
    catch(err){
        console.log(err);
        res.status(500).send('Internal servor error');
    }

});
//api to get all tickets
app.post('/get-pending-tickets',async(req,res)=>{
    try{
        const {etat}=req.body //il faut ecrire les {} pour acceder au valeur de l'atribut etat dans ficheir json. 
        const result = await db_cnx.query('select * from public."Tickets"  where id_etat = $1 ;',[etat])
        res.json(result.rows);
    }
    catch(err){
      console.log(err);
      res.status(500).send('Internal Servor Error');
    }
})
//api to search for tickets
app.post('/search-tickets',async(req,res)=>{
    try{
      const {id_categorie,f_date,l_date,id_etat}=req.body;
      console.log(f_date);
      console.log(typeof(l_date));
      if(f_date===null && l_date===null){
        const result= await db_cnx.query('select * from public."Tickets"  where id_categorie=coalesce($1,id_categorie) and id_etat=coalesce($2,id_etat);', [id_categorie,id_etat]);
        res.json(result.rows);
      }
      else{
        const result= await db_cnx.query('select * from public."Tickets"  where id_categorie=coalesce($1,id_categorie)and date_ticket between $2 and $3 and id_etat=coalesce($4,id_etat); ', [id_categorie,f_date,l_date,id_etat]);
        res.json(result.rows);
      }
    }
    catch(err){
        console.log(err);
        res.status(500).send('Internal Servor Error');
    }
});
//api to delete ticket :
app.delete('/delete-ticket/:id',async(req,res)=>{
    try{
        const id =  req.params.id;
        const result =await db_cnx.query(`delete from public."Tickets" where id=${parseInt(id)};`);
        if (result.rowCount > 0) {
            res.status(200).json({ message: 'User deleted successfully' });
          } else {
            res.status(404).json({ message: 'User not found' });
          }
    }
    catch(err){
    console.log('ticket pas supprimé');
     console.log(err);
     res.status(500).send('An Error occured while deleting the user');
    }
});
//api to find ticket by id :
app.get('/find-ticket/:id',async(req,res)=>{
    try{
        const id = req.params.id;
       const result=await db_cnx.query('select * from public."Tickets" where id=$1 ;',[id]);
       res.json(result.rows);
    }
    catch(err){
        console.log(err)
        res.status(500).send('Internal servor error');
    }
});
//api to change state of ticket
app.put('/update-ticket/:id',async(req,res)=>{
    try{
        const  id  = req.params.id;
        console.log(id)
        const { id_etat } = req.body;
        const result= await db_cnx.query(`update public."Tickets" SET id_etat =$1 WHERE id =$2;`, [id_etat, id])
        res.json(result.rows);
    }
    catch(err){
        console.log(err);
        res.status(500).send('Internal Servor Error');
    }
});
//api to display ticket images
// Define the directory where images are stored
const imagesDirectory = path.join('C:/Users/Public/upload');
// Serve static files from this directory
app.use('/images', express.static(imagesDirectory));

app.post('/display-image',async(req,res)=>{
try{
const {imgPath}=req.body
fs.readdir(imgPath,(err,files)=>{
    if (err) {
        return res.status(500).send('Unable to scan directory');
    }
    //const imagePaths = files.map(file => path.join(imgPath, file));
    //res.json(imagePaths);
    // Get the directory name to append to the URL
    const directoryName = path.basename(imgPath);
    const imageUrls = files.map(file => `/images/${directoryName}/${file}`);
    res.json(imageUrls);
})
}
catch(err){
    console.log(err);
    res.status(500).send('Internal Servor error');
}
});
//start the server
app.listen(port, () => {
    console.log(`App is listening on port ${port}`);
});