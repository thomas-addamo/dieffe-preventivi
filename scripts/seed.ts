import { db } from "../src/lib/db/client";
import {
  users,
  companySettings,
  clients,
  quotes,
  quoteSections,
  quoteItems,
  quoteYearCounters,
  quoteTemplates,
  priceListItems,
} from "../src/lib/db/schema";
import { hashPassword } from "../src/lib/auth";
import { generateId } from "../src/lib/utils";
import { calcItemTotal } from "../src/lib/calculations";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Seed database...");

  // Se l'admin esiste già, il database è già stato inizializzato
  const [existingAdmin] = await db
    .select()
    .from(users)
    .where(eq(users.email, "admin@dieffe.it"))
    .limit(1);

  if (existingAdmin) {
    console.log("✓ Seed già eseguito in precedenza, nessuna modifica.");
    process.exit(0);
  }

  // Admin user
  const adminId = generateId();
  const adminHash = await hashPassword("admin123");
  await db.insert(users).values({
    id: adminId,
    email: "admin@dieffe.it",
    passwordHash: adminHash,
    name: "Andrea Addamo",
    role: "admin",
    mustChangePassword: true,
  });
  console.log("✓ Utente admin creato: admin@dieffe.it / admin123");

  // Company settings
  await db.insert(companySettings).values({
    companyName: "Dieffe Ristrutturazioni",
    address: "Via Pastrengo 21, 10024 Moncalieri (TO)",
    vatNumber: "IT10908150013",
    email: "impresa.dieffe@gmail.com",
    phone: "+39 011 000 0000",
    website: "diefferistrutturazioni.it",
    defaultVatRate: 10,
    pdfTemplate: "classic",
    primaryColor: "#1e40af",
    accentColor: "#059669",
  });
  console.log("✓ Impostazioni azienda");

  // Clients
  const client1Id = generateId();
  const client2Id = generateId();

  await db.insert(clients).values([
    {
      id: client1Id,
      name: "Condominio Via Torino 31-33",
      address: "Via Torino 31-33, 10042 Nichelino (TO)",
      vatNumber: "",
      email: "amministratore@condominiotorino.it",
      phone: "011 123 4567",
      notes: "Condominio 24 unità, lavori cappotto + demolizioni",
    },
    {
      id: client2Id,
      name: "Rossi Mario",
      address: "Corso Moncalieri 100, 10024 Moncalieri (TO)",
      email: "mario.rossi@email.it",
      phone: "333 123 4567",
    },
  ]);
  console.log("✓ Clienti esempio");

  // Year counter
  const year = new Date().getFullYear();
  await db.insert(quoteYearCounters).values({ year, counter: 1 });

  // Sample quote
  const quoteId = generateId();
  await db.insert(quotes).values({
    id: quoteId,
    code: `PREV-${year}-001`,
    title: "Ristrutturazione Condominio Via Torino 31-33 Nichelino",
    clientId: client1Id,
    userId: adminId,
    status: "draft",
    projectAddress: "Via Torino 31-33, 10042 Nichelino (TO)",
    vatRate: 10,
    paymentTerms:
      "20% all'accettazione del preventivo, 30% inizio lavori, 30% a metà lavori, 20% alla consegna",
  });

  // Sections
  const secA = generateId();
  const secB = generateId();
  const secF = generateId();

  await db.insert(quoteSections).values([
    {
      id: secA,
      quoteId,
      code: "A",
      title: "ALLESTIMENTO CANTIERE",
      orderIndex: 0,
    },
    {
      id: secB,
      quoteId,
      code: "B",
      title: "DEMOLIZIONI",
      orderIndex: 1,
    },
    {
      id: secF,
      quoteId,
      code: "F",
      title: "CAPPOTTO TERMICO",
      description: "Isolamento a cappotto con pannelli EPS",
      orderIndex: 2,
    },
  ]);

  // Items for section A
  const itemsA = [
    {
      desc: "Ponteggio metallico a telai prefabbricati tipo Plettac o similare, montaggio e smontaggio compreso",
      um: "mq",
      qty: 580,
      price: 6.5,
      disc: 0,
    },
    {
      desc: "Nolo ponteggio per la durata dei lavori, comprensivo di teli di protezione e reti anti-caduta",
      um: "mq",
      qty: 580,
      price: 1.2,
      disc: 0,
    },
    {
      desc: "Installazione cantiere: recinzione, baracca, servizi igienici, segnaletica di sicurezza",
      um: "a corpo",
      qty: 1,
      price: 2800,
      disc: 0,
    },
  ];

  for (let i = 0; i < itemsA.length; i++) {
    const it = itemsA[i];
    await db.insert(quoteItems).values({
      id: generateId(),
      sectionId: secA,
      description: it.desc,
      unitOfMeasure: it.um,
      quantity: it.qty,
      unitPrice: it.price,
      discount: it.disc,
      total: calcItemTotal(it.qty, it.price, it.disc),
      orderIndex: i,
    });
  }

  // Items for section B
  const itemsB = [
    {
      desc: "Demolizione intonaco esterno esistente a mano e con martello demolitore, carico e trasporto a discarica",
      um: "mq",
      qty: 520,
      price: 12.5,
      disc: 0,
    },
    {
      desc: "Smontaggio e reintegro soglie, davanzali, cornicioni in cemento ammalorati",
      um: "ml",
      qty: 85,
      price: 35,
      disc: 0,
    },
  ];

  for (let i = 0; i < itemsB.length; i++) {
    const it = itemsB[i];
    await db.insert(quoteItems).values({
      id: generateId(),
      sectionId: secB,
      description: it.desc,
      unitOfMeasure: it.um,
      quantity: it.qty,
      unitPrice: it.price,
      discount: it.disc,
      total: calcItemTotal(it.qty, it.price, it.disc),
      orderIndex: i,
    });
  }

  // Items for section F
  const itemsF = [
    {
      desc: "Fornitura e posa cappotto termico EPS 100 mm densità 20 kg/mc, conforme ETICS, compreso ancoraggio meccanico, rasatura armata con rete in fibra di vetro 160 gr/mq, finitura con intonaco acrilico al quarzo 1.5 mm",
      um: "mq",
      qty: 480,
      price: 85,
      disc: 5,
    },
    {
      desc: "Profili di partenza in alluminio, profili angolari, giunti di dilatazione e accessori",
      um: "ml",
      qty: 120,
      price: 8.5,
      disc: 0,
    },
    {
      desc: "Ripristino e rifacimento davanzali in cemento pigmentato, compreso inserimento profilo gocciolatoio",
      um: "ml",
      qty: 85,
      price: 42,
      disc: 0,
    },
    {
      desc: "Fornitura e posa coibentazione contorno finestre e porte in EPS 30 mm spessore, compreso tinteggiatura",
      um: "n°",
      qty: 48,
      price: 95,
      disc: 0,
    },
  ];

  for (let i = 0; i < itemsF.length; i++) {
    const it = itemsF[i];
    await db.insert(quoteItems).values({
      id: generateId(),
      sectionId: secF,
      description: it.desc,
      unitOfMeasure: it.um,
      quantity: it.qty,
      unitPrice: it.price,
      discount: it.disc,
      total: calcItemTotal(it.qty, it.price, it.disc),
      orderIndex: i,
    });
  }

  console.log("✓ Preventivo esempio");

  // Templates
  await db.insert(quoteTemplates).values([
    {
      id: generateId(),
      name: "Allestimento cantiere standard",
      description: "Ponteggio, recinzione, baracca e segnaletica",
      userId: adminId,
      data: {
        sections: [
          {
            code: "A",
            title: "ALLESTIMENTO CANTIERE",
            items: [
              {
                description:
                  "Ponteggio metallico a telai prefabbricati tipo Plettac",
                unitOfMeasure: "mq",
                quantity: 1,
                unitPrice: 6.5,
                discount: 0,
              },
              {
                description: "Nolo ponteggio mensile",
                unitOfMeasure: "mq",
                quantity: 1,
                unitPrice: 1.2,
                discount: 0,
              },
              {
                description: "Installazione cantiere completa",
                unitOfMeasure: "a corpo",
                quantity: 1,
                unitPrice: 2800,
                discount: 0,
              },
            ],
          },
        ],
      },
    },
    {
      id: generateId(),
      name: "Cappotto termico EPS",
      description: "Sistema a cappotto EPS 100mm con finitura acrilica",
      userId: adminId,
      data: {
        sections: [
          {
            code: "F",
            title: "CAPPOTTO TERMICO",
            items: [
              {
                description:
                  "Fornitura e posa cappotto EPS 100mm ETICS completo di rasatura e finitura",
                unitOfMeasure: "mq",
                quantity: 1,
                unitPrice: 85,
                discount: 0,
              },
              {
                description: "Profili e accessori",
                unitOfMeasure: "ml",
                quantity: 1,
                unitPrice: 8.5,
                discount: 0,
              },
            ],
          },
        ],
      },
    },
    {
      id: generateId(),
      name: "Demolizioni base",
      description: "Demolizione intonaco esterno e ripristini",
      userId: adminId,
      data: {
        sections: [
          {
            code: "B",
            title: "DEMOLIZIONI",
            items: [
              {
                description:
                  "Demolizione intonaco esterno a mano e con martello demolitore, carico e trasporto a discarica",
                unitOfMeasure: "mq",
                quantity: 1,
                unitPrice: 12.5,
                discount: 0,
              },
            ],
          },
        ],
      },
    },
  ]);

  console.log("✓ Template");

  // Price list seed
  const priceListSeed = [
    { code: 'ALL-001', description: 'Impianto di cantiere regolamentare con WC chimico, baracca e recinzione', unitOfMeasure: 'a corpo', unitPrice: '15300.00', category: 'Allestimento Cantiere' },
    { code: 'ALL-002', description: 'Fornitura di energia elettrica per esecuzione delle opere', unitOfMeasure: 'vs.carico', unitPrice: '0.00', category: 'Allestimento Cantiere' },
    { code: 'DEM-001', description: 'Rimozione totale della controsoffittatura con smaltimento materiale di risulta', unitOfMeasure: 'mq', unitPrice: '80.00', category: 'Demolizioni' },
    { code: 'DEM-002', description: 'Demolizione intonaco esterno esistente a mano e con martello demolitore, carico e trasporto a discarica autorizzata', unitOfMeasure: 'mq', unitPrice: '12.50', category: 'Demolizioni' },
    { code: 'CAP-001', description: 'Isolamento a cappotto con pannelli EPS Neopor con grafite 14cm con rasatura collante a due mani con interposizione di rete in fibra di vetro', unitOfMeasure: 'mq', unitPrice: '75.00', category: 'Cappotto Termico' },
    { code: 'CAP-002', description: 'Fornitura e posa di intonachino Acril-silosanico colorato su pareti verticali isolate', unitOfMeasure: 'mq', unitPrice: '35.00', category: 'Cappotto Termico' },
    { code: 'CAP-003', description: 'Profili di partenza in alluminio, profili angolari, giunti di dilatazione e accessori per cappotto', unitOfMeasure: 'ml', unitPrice: '8.50', category: 'Cappotto Termico' },
    { code: 'TIN-001', description: 'Tinteggiatura interna a due mani con colori a scelta su pareti e soffitti', unitOfMeasure: 'mq', unitPrice: '12.00', category: 'Tinteggiature' },
    { code: 'TIN-002', description: 'Rasatura e tinteggiatura esterna con vernice acril-silossanica idrorepellente', unitOfMeasure: 'mq', unitPrice: '22.00', category: 'Tinteggiature' },
    { code: 'IMP-001', description: 'Impermeabilizzazione terrazza con membrana bituminosa armata doppio strato', unitOfMeasure: 'mq', unitPrice: '85.00', category: 'Impermeabilizzazioni' },
    { code: 'IMP-002', description: 'Impermeabilizzazione balcone con resina poliuretanica a due componenti', unitOfMeasure: 'mq', unitPrice: '65.00', category: 'Impermeabilizzazioni' },
    { code: 'PAV-001', description: 'Fornitura e posa di pavimento in gres porcellanato 60x60 con fughe', unitOfMeasure: 'mq', unitPrice: '65.00', category: 'Pavimenti' },
    { code: 'PAV-002', description: 'Rasatura del sottofondo con massetto autolivellante', unitOfMeasure: 'mq', unitPrice: '18.00', category: 'Pavimenti' },
    { code: 'IMP-ELE-001', description: 'Rifacimento impianto elettrico a norma CEI con quadro certificato', unitOfMeasure: 'a corpo', unitPrice: '3500.00', category: 'Impianti Elettrici' },
    { code: 'IMP-IDR-001', description: 'Rifacimento impianto idraulico bagno completo con rubinetteria', unitOfMeasure: 'a corpo', unitPrice: '2800.00', category: 'Impianti Idraulici' },
    { code: 'PON-001', description: 'Ponteggio metallico a telai prefabbricati tipo Plettac o similare, montaggio e smontaggio compreso', unitOfMeasure: 'mq', unitPrice: '6.50', category: 'Allestimento Cantiere' },
    { code: 'PON-002', description: 'Nolo ponteggio mensile per la durata dei lavori, comprensivo di teli di protezione', unitOfMeasure: 'mq', unitPrice: '1.20', category: 'Allestimento Cantiere' },
  ];

  await db.insert(priceListItems).values(
    priceListSeed.map((item) => ({
      ...item,
      isActive: true,
    }))
  );
  console.log("✓ Listino prezzi esempio");

  console.log("\n✅ Seed completato!");
  console.log("   Login: admin@dieffe.it / admin123");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
