// const Vacante = require('../models/Vacantes');
const mongoose = require('mongoose');
const Vacante = mongoose.model('Vacante');
const multer = require('multer');
const shortid = require('shortid');


exports.formularioNuevaVacante = (req,res) => {
    res.render('nueva-vacante',{
        nombrePagina:'Nueva Vacante',
        tagline:'Llena el formulario y publica tu vacante',
        cerrarSesion:true,
        nombre:req.user.nombre,
        imagen:req.user.imagen
    })
}

//agrega las vacantes a la BD 
exports.agregarVacante = async(req,res) => {
    const vacante = new Vacante(req.body);

    //Usuario autor de la vacante
    vacante.autor = req.user._id;

    //crear arreglo de habilidades (skills)
    vacante.skills = req.body.skills.split(',');


    //almacenarlo en la base de datos
    const nuevaVacante = await vacante.save();


    //Redireccionar
    res.redirect(`/vacantes/${nuevaVacante.url}`);
    
}

//muestra una vacante
exports.mostrarVacante = async (req,res,next) =>{
    const vacante = await Vacante.findOne({url:req.params.url}).populate('autor').lean();

    //Si no hay resultados
    if(!vacante) return next();

    res.render('vacante',{
        vacante,
        nombrePagina:vacante.titulo,
        barra:true
    })

}

exports.formEditarVacante = async (req,res,next) =>{
    
    const vacante = await Vacante.findOne({url:req.params.url});
    const gol = [];
    const contrak= [];
    

    if(!vacante) return next();

    res.render('editar-vacante',{
        vacante,
        nombrePagina:`Editar - ${vacante.titulo}`,
        gol:vacante.skills,
        contrak:vacante.contrato,
        cerrarSesion:true,
        nombre:req.user.nombre,
        imagen:req.user.imagen
    })
    
}

exports.editarVacante = async(req,res) => {
   
    const vacanteActualizada = req.body;

    
    vacanteActualizada.skills = req.body.skills.split(',');
    
    //Necesito en el primer parametro que sea el _id del array
    const vacante = await Vacante.findByIdAndUpdate('61b443f3903e7d5a2f10e689',
    vacanteActualizada, {
        new:true,
        runValidators:true
    });

    //Necesito la url para que redireccione
    res.redirect(`/vacantes/${vacante.url}}`);


    // console.log("********************************");
    // console.log(vacante);
}

//Validar y sanitizar los campos de las vacantes
exports.validarVacante = (req,res,next) =>{
    //Sanitizar los campos

    req.sanitizeBody('titulo').escape();
    req.sanitizeBody('empresa').escape();
    req.sanitizeBody('ubicacion').escape();
    req.sanitizeBody('salario').escape();
    req.sanitizeBody('contrato').escape();
    req.sanitizeBody('skills').escape();
    
    
    //validar
    req.checkBody('titulo','Agrega un titulo a la vacante').notEmpty();
    req.checkBody('empresa','Agregar una Empresa').notEmpty();
    req.checkBody('ubicacion','Agregar una Ubicacion').notEmpty();
    req.checkBody('contrato','Selecciona el tipo de contrato').notEmpty();
    req.checkBody('skills','Agregar al menos una habilidad').notEmpty();

    const errores = req.validationErrors();

    if(errores){
        //Recargar la vista con los errores
        req.flash('error',errores.map(error => error.msg));

        res.render('nueva-vacante',{
            nombrePagina:'Nueva Vacante',
            tagline:'Llena el formulario y publica tu vacante',
            cerrarSesion:true,
            nombre:req.user.nombre,
            mensajes:req.flash()
        })
    }

    next();//Siguiente moddleware
}

exports.eliminarVacante = async(req,res) =>{
    const {id} = req.params;

    const vacante = await Vacante.findById(id);
    if(verificarAutor(vacante,req.user)){
        //Todo esta bien
        res.status(200).send('Vacante Eliminada Correctamente');
    }else{
        //no permitido
        res.status(403).send('Error');
    }
    
}

const verificarAutor = (vacante = {},usuario={})=>{
    if(!vacante.autor.equals(usuario._id)){
        return false;
    }
    return true;
}

//Subir archivos en PDF
exports.subirCV = (req,res,next) => {
    upload(req,res,function(error){
        if(error){
            if(error instanceof multer.MulterError){
                if(error.code === 'LIMIT_FILE_SIZE'){
                    req.flash('error','El archivo es muy grande:Maximo 100kb');
                }else{
                    req.flash('error',error.message);
                }
            }else{
                req.flash('error',error.message);
            }
            res.redirect('back');
            return;
        }else{
            return next();
        }        
    });
}

const configuracionMulter = {
    limits:{
        fileSize:100000
    },
    storage: fileStorage = multer.diskStorage({
        destination:(req,file,cb) =>{
            cb(null,__dirname+'../../public/uploads/cv');
        },
        filename:(req,file,cb)=>{
            const extension = file.mimetype.split('/')[1];
            cb(null,`${shortid.generate()}.${extension}`);
        }
    }),
    fileFilter(req,file,cb){
        if(file.mimetype === 'application/pdf'){
            //El callback se ejecuta como true o false : true cuando la imagen se acepta
            cb(null,true);
        }else{
            cb(new Error('Formato no valido'),false);
        }
    }
}

const upload = multer(configuracionMulter).single('cv');

exports.contactar = async (req,res,next) =>{
    const vacante = await Vacante.findOne({url:req.params.url});

    //Sino existe la vancate
    if(!vacante) return next();

    //Todo bien,construir el nuevo objeto
    const nuevoCandidato = {
        nombre: req.body.nombre,
        email:req.body.email,
        cv:req.file.filename
    }

    //Almacenar la vacante
    vacante.candidatos.push(nuevoCandidato);
    await vacante.save();

    //Mensajes flash y redireccionamiento
    req.flash('correcto','Se envio tu curriculum correctamente');
    res.redirect('/');
}

exports.mostrarCandidatos = async (req,res,next) =>{
    const vacante = await Vacante.findById(req.params.id).lean();
    // console.log(vacante.candidatos);
    // console.log(req.user._id);

    // console.log(typeof vacante.autor);
    // console.log(typeof req.user._id);

    

    if(vacante.autor != req.user._id.toString()){
        return next();
    }

    if(!vacante) return next();


    res.render('candidatos',{
        nombrePagina:`Candidatos Vacante - ${vacante.titulo}`,
        cerrarSesion: true,
        nombre:req.user.nombre,
        imagen:req.user.imagen,
        candidatos: vacante.candidatos
    })
    
}

//Buscador de vacantes
exports.buscarVacantes = async(req,res)=>{
   
    const vacantes = await Vacante.find({
        $text:{
            $search : req.body.q
        }
    }).lean() ;

    //mostrar las vacantes
    res.render('home',{
        nombrePagina:`Resultados para la busqueda : ${req.body.q}`,
        barra:true,
        vacantes
    })
    console.log("******************************** cagadaso ****************");
    console.log(vacantes);
}




// .lean()   --------------> hay que ponerle a cada consulta a la BD para que devuelva xvr las consultas