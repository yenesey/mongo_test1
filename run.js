const numWorkers = 4
const times = 50 // -по заданию
const cluster = require('cluster')
const mongoose = require('mongoose')
const chalk   = require('chalk')
const cyan = (text) => chalk.cyan.bold(text)
const yellow = (text) => chalk.yellow.bold(text)
const log = console.log

/*
	Соединяемся с базой, создаем схему и коллекцию
*/
mongoose.connect('mongodb://localhost/test', { useNewUrlParser: true })
const Schema = new mongoose.Schema({ counter: Number })
const Doc = mongoose.model('doc', Schema)

/*
	Основной процесс, добавляет документ в коллекцию и создает 'workers' 
	для теста над только что созданным документом
*/
if (cluster.isMaster) {
	log(cyan(`Master ${process.pid} is running`))
	log(cyan('Creating document item...'))
	Doc.create({ counter: 0 }).then(doc=>{
		log(cyan('Done:') + yellow(doc))
		log(cyan('Creating workers...'))
		let _id = doc._id
		for (let i = 0; i < numWorkers; i++) 
			cluster.fork({_id : _id, inc : i % 2 === 0?1:-1 })

		cluster.on('exit', (worker, code, signal) => {
			//тут отлавливаем завершение работы дочерних процессов
			 log(cyan(`Worker ${worker.process.pid} done`))

			//если больше нет дочерних, пора вывести результаты
			if (Object.keys(cluster.workers).length === 0){ 
				log(cyan('Reloading document...'))
				Doc.findOne({_id}).then(doc=>{
					log(cyan('Done:') + yellow(doc))
					process.exit(0)
				}).catch(console.error)
			}	
		})

	})
	.catch(console.error)

} else {
/*
	Отдельный дочерний процесс с индивидуальным заданием
*/
	if (!(process.env._id && process.env.inc)){
		console.log('не передан _id и/или счетчик')
		process.exit(0)	
	}
	let counter = parseInt(process.env.inc)
	let _id = process.env._id

	log(`Worker ${process.pid} started task on _id = ${process.env._id} : inc ${counter} about ${times} times`)
		
	var ops = []
	for (let i = 0; i < times; i++) 
		ops[i] = Doc.updateOne({ _id }, {$inc : { counter }} ).exec()
	
	Promise.all(ops)
	.then(res=>process.exit(0))
	.catch(err=>{
		console.error(err)
		process.exit(0)
	})
	
}