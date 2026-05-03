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
} from "../src/lib/db/schema";
import { hashPassword } from "../src/lib/auth";
import { generateId } from "../src/lib/utils";
import { calcItemTotal } from "../src/lib/calculations";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Seeding database...");

  // Admin user — fetch existing or insert new
  const existingAdmin = db
    .select()
    .from(users)
    .where(eq(users.email, "admin@dieffe.it"))
    .get();

  let adminId: string;
  if (existingAdmin) {
    adminId = existingAdmin.id;
    console.log("✓ Utente admin già presente");
  } else {
    adminId = generateId();
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
  }

  // Company settings
  await db
    .insert(companySettings)
    .values({
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
    })
    .onConflictDoNothing();

  console.log("✓ Impostazioni azienda");

  // Clients
  const client1Id = generateId();
  const client2Id = generateId();

  await db
    .insert(clients)
    .values([
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
    ])
    .onConflictDoNothing();

  console.log("✓ Clienti esempio");

  // Year counter
  const year = new Date().getFullYear();
  await db
    .insert(quoteYearCounters)
    .values({ year, counter: 1 })
    .onConflictDoNothing();

  // Sample quote
  const quoteId = generateId();
  await db
    .insert(quotes)
    .values({
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
    })
    .onConflictDoNothing();

  // Sections
  const secA = generateId();
  const secB = generateId();
  const secF = generateId();

  await db
    .insert(quoteSections)
    .values([
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
    ])
    .onConflictDoNothing();

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
    await db
      .insert(quoteItems)
      .values({
        id: generateId(),
        sectionId: secA,
        description: it.desc,
        unitOfMeasure: it.um,
        quantity: it.qty,
        unitPrice: it.price,
        discount: it.disc,
        total: calcItemTotal(it.qty, it.price, it.disc),
        orderIndex: i,
      })
      .onConflictDoNothing();
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
    await db
      .insert(quoteItems)
      .values({
        id: generateId(),
        sectionId: secB,
        description: it.desc,
        unitOfMeasure: it.um,
        quantity: it.qty,
        unitPrice: it.price,
        discount: it.disc,
        total: calcItemTotal(it.qty, it.price, it.disc),
        orderIndex: i,
      })
      .onConflictDoNothing();
  }

  // Items for section F
  const itemsF = [
    {
      desc: 'Fornitura e posa cappotto termico EPS 100 mm densità 20 kg/mc, conforme ETICS, compreso ancoraggio meccanico, rasatura armata con rete in fibra di vetro 160 gr/mq, finitura con intonaco acrilico al quarzo 1.5 mm',
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
    await db
      .insert(quoteItems)
      .values({
        id: generateId(),
        sectionId: secF,
        description: it.desc,
        unitOfMeasure: it.um,
        quantity: it.qty,
        unitPrice: it.price,
        discount: it.disc,
        total: calcItemTotal(it.qty, it.price, it.disc),
        orderIndex: i,
      })
      .onConflictDoNothing();
  }

  console.log("✓ Preventivo esempio");

  // Templates
  await db
    .insert(quoteTemplates)
    .values([
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
                  description:
                    "Installazione cantiere completa",
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
    ])
    .onConflictDoNothing();

  console.log("✓ Template");
  console.log("\n✅ Seed completato!");
  console.log("   Login: admin@dieffe.it / admin123");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
