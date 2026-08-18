# Cooja/Energest as the principal tool for a 120-minute Leo energy course

Date: 2026-08-10
Scope: adversarial, read-only evaluation of Contiki-NG/Cooja/Energest as the
principal hands-on tool for 20 non-communications STEM students learning
smart-energy/IoT decision making in a 120-minute class paired with the Leo beam
simulator.

## Decisive verdict

**KEEP-AS-OPTIONAL. Do not make Cooja/Energest the principal tool.**

Cooja/Energest is the strongest of the considered external tools for exposing a
real low-power state mechanism: CPU active, low-power mode, transmit, and listen
time can be connected to a supplied current/voltage table. However, its official
setup path has Java, Gradle, Contiki-NG source/submodules, Docker/display and
platform-specific constraints. Cooja native motes are not hardware-precise, and
Energest is a software estimate rather than an electrical measurement. Those
facts make it a poor beginner critical path in a 120-minute, 20-seat class.

Use a prebuilt Cooja/Energest replay only as an optional specialist or evidence
extension after the Leo-native decision loop works. Keep the principal path in
one browser workbench where the learner changes a reporting/batching/sleep
policy and immediately receives a fixed-service energy ledger. Cooja earns a
main-course promotion only after a separate 20-seat rehearsal proves the setup,
adapter, and timing gates below.

This is a recommendation, not a product or classroom PASS.

## Evidence boundary

The labels below separate what the cited primary sources establish from the
pedagogical inference drawn from them.

- **VERIFIED:** stated by Contiki-NG, Wokwi, SimPy, or the current Leo source.
- **INFERENCE:** an evaluation of classroom risk or learning value from those
  facts and the stated audience/time constraint.
- **UNKNOWN:** requires a controlled novice/20-seat rehearsal; it is not filled
  by documentation or source inspection.

No secondary article was used. The primary sources are the official
Contiki-NG documentation, official Wokwi/SimPy documentation, and the Leo
source files linked below.

## 1. Setup, cross-platform, and classroom risk

### Verified facts

The official Cooja tutorial requires the appropriate Java VM, the Cooja
submodule, a Gradle build/start step, creation of a mote type, and compilation
of a Contiki-NG project before the learner can start the simulation. It then
offers topology, simulation-control, mote-output, timeline, and radio-message
views, and saves simulations as .csc files. See [Running Contiki-NG in
Cooja](https://docs.contiki-ng.org/en/master/doc/tutorials/Running-Contiki-NG-in-Cooja.html).

Contiki-NG documents Cooja native motes as native processes that are fast but do
not simulate mote hardware precisely; Sky motes use MSPSim for cycle-accurate
hardware emulation. The Cooja native platform is also documented as requiring a
32-bit OS, with Docker used to provide that environment on 64-bit hosts. See
[Cooja native motes](https://docs.contiki-ng.org/en/release-v4.8/doc/platforms/cooja.html).

The official Docker path requires Docker installation, a user-group change and
logout/login. Its Windows path requires Docker for Windows and VcXsrv/shared
drive handling, documents a WSL repository-path limitation, and its macOS GUI
path can require XQuartz and socat. See [Contiki-NG Docker
setup](https://docs.contiki-ng.org/en/master/doc/getting-started/Docker.html).

### Evaluation

**INFERENCE: setup risk is high.** A prebuilt image can remove most of the
wall-clock cost, but it does not remove display, container, Java, architecture,
filesystem, and version failure modes. A novice class cannot treat “install
Docker/Java, clone submodules, compile a mote, and debug a GUI” as meaningful
energy operation. If those steps are included, they can consume the whole class;
if they are pre-done, they should be treated as instructor infrastructure, not
student learning.

For 20 seats, the only defensible Cooja shape is a pinned container/image,
precompiled .csc simulation, one tested browser/desktop path, and a recovery
artifact. Each learner should change only an allowed policy input, not create a
new mote type or compile the Contiki-NG tree during the critical path.

## 2. Direct energy-learning validity and evidence limits

### Verified facts

Energest is explicitly described by Contiki-NG as a lightweight,
software-based **energy estimation** approach. It tracks how long components
are in states; energy is estimated only when the power consumption of those
components is known. The standard types cover CPU, LPM, deep LPM, transmit, and
listen. See [Energest](https://docs.contiki-ng.org/en/develop/doc/programming/Energest.html).

The official energy tutorial prints CPU active/sleep/deep-sleep time and radio
off/listen/transmit time, and says that the time plus component power is used to
estimate energy. It also notes that the native platform does not sleep, making
an embedded target more informative for sleep behavior. See [Energy
monitoring](https://docs.contiki-ng.org/en/master/doc/tutorials/Energy-monitoring.html).

### What Cooja/Energest can teach directly

With a transparent, supplied table such as state -> current -> voltage, a
learner can perform a valid bounded experiment:

1. Keep useful payload, deadline/freshness, link window, and boundary fixed.
2. Choose periodic-send versus batching/sleep, or two duty-cycle policies.
3. Run the same trace twice.
4. Observe CPU/LPM/TX/LISTEN state time and service outcome.
5. Convert state time to estimated J and compare only when service passes.

That is a real causal energy mechanism at the **modelled embedded-node** level.
It is more direct than merely counting packets or looking at throughput.

### Limits that must remain visible

- Energest reports state occupancy and needs an assumed power table; it is not a
  power-meter trace. The output should be labelled estimated, with the table
  and units exported alongside it.
- Cooja native motes are not hardware-precise, and the native platform's sleep
  behavior is not representative. A lesson that claims measured node energy
  from a native Cooja run is overclaiming.
- The radio model, clock resolution, driver state transitions, and assumed
  current values can dominate the result. A student may learn the intended
  power-time pathway, but not a calibrated device's wall-plug energy.
- Packet count, radio messages, or “more sleep” alone do not establish useful
  service. The course needs a fixed payload, deadline/freshness gate, same
  scenario, and a ledger with state time, estimated J, delivered bits, and
  service pass.

**Verdict for criterion 2: CONDITIONAL PASS for learning validity; FAIL for
measured-energy claims.** The condition is a transparent model and a service
controlled comparison, not simply enabling Energest.

## 3. Is Leo integration causal or decorative?

### Verified facts in the current Leo source

The C-120 contract has explicit units for W, J, bit/s, bits, and bit/J, and an
explicit claim boundary that the course values are simulated, not live,
measured, or canonical-parity-verified. Its evidence object contains service,
deadline, freshness, power, consumed energy, budget, delivered bits, active
time, switch count, and wake count. See the [C-120 contract](/home/u24/demo/leo-beam-sim/src/course/c120/contract.ts:1).

The same contract currently permits only typed Lab A/B/C/clinic replay inputs,
including candidate/rule/schedule/action fields; it does not contain a Cooja
run identifier, node-state trace, Energest state vector, or radio model receipt.
See the [C-120 replay-input contract](/home/u24/demo/leo-beam-sim/src/course/c120/contract.ts:195).

The replay helper describes its frame values as authored replay values and
attaches identity to them; the resolver then selects an existing authoritative
replay matching the typed input. See [replay.ts](/home/u24/demo/leo-beam-sim/src/course/c120/replay.ts:21)
and [replay resolution](/home/u24/demo/leo-beam-sim/src/course/c120/replay.ts:201).

The Leo scene renders the satellite, beam, visibility, state label, action label,
and the servicePass colour from the current replay frame; it also displays the
claim boundary. See [C120CourseScene.tsx](/home/u24/demo/leo-beam-sim/src/course/c120/C120CourseScene.tsx:103).

The materialized scenario rebinds the replay frames to an SGP4/model-derived
visual trajectory but carries the donor frame's evidence through unchanged. It
explicitly says geometry cannot make an authored fixed outage visible. See
[materializedScenario.ts](/home/u24/demo/leo-beam-sim/src/course/c120/backend/materializedScenario.ts:253).

### Evaluation

**VERIFIED from the source seam:** Leo already has a coherent simulated replay
surface, but the current seam is not a Cooja execution seam. A Cooja screenshot,
CSV, or Energest number placed beside the Leo scene would be decorative unless
the following causal contract is implemented and tested:

1. The learner's Leo action (for example, report interval, batch interval, or
   sleep policy) becomes a Cooja input, not just a note.
2. The same scenario_id/trial identity binds Leo's service window and Cooja's
   application, radio, seed, and timing configuration.
3. Cooja runs the changed policy and returns state-time, packet/service, and
   estimated-energy results.
4. The returned result changes the Leo replay ledger and observable scene/state
   in the same trial; an animation-only change is insufficient.
5. A baseline, a learner choice, and a withheld or changed-window case can be
   replayed under the same service boundary.

Without this adapter, Cooja supplies a second disconnected simulator and Leo
remains a visual index. With it, Cooja can be a causal backend, but the
integration is a substantial provider/fixture contract and classroom-validation
task, not a plug-in exercise.

**Verdict for criterion 3: currently DECORATIVE BY DEFAULT; conditionally
CAUSAL after a separate provider/replay seam.** This is why it should not be the
principal tool before that seam is proven.

## 4. Engagement and time-on-task

Cooja has genuine learner-facing affordances: topology, pause/reload, mote
output, timeline, and radio-message views. The official RPL tutorial shows
students adding server/client motes, running the network, filtering output, and
linking timeline events to packet transmissions, receptions, and collisions. See
[RPL network in Cooja](https://docs.contiki-ng.org/en/master/doc/tutorials/Running-a-RPL-network-in-Cooja.html).

**INFERENCE:** this can be engaging for students who want network-simulation or
embedded-systems experience. It is not automatically engaging for an energy
course. The active work becomes energy learning only when the learner predicts a
service/energy trade-off, changes one power-time policy, reruns the same case,
and explains the state-time ledger. Topology dragging, packet inspection, C
compilation, or protocol debugging alone is domain activity, not energy agency.

The smallest meaningful Cooja extension would be two prebuilt trials, not a
new protocol or algorithm:

- Trial 1: fixed payload/deadline, periodic reporting.
- Trial 2: the learner chooses a larger reporting interval or batching/sleep
  policy.
- Output: CPU/LPM/TX/LISTEN time, estimated J from a provided table, delivered
  bits, freshness/deadline, and one short explanation.
- Optional withheld case: shorter contact window or urgent packet, with no
  retuning after freeze.

This is enough to occupy meaningful hands-on time without installation filler.
It does not justify making Cooja the whole 120-minute course.

## 5. Alternatives

| Alternative | Setup/classroom profile | Energy-learning validity | Leo relationship | 120-minute role | Assessment |
|---|---|---|---|---|---|
| **Leo-only browser workbench** | Lowest if host is pre-served; one app and one workbook | Strongest for a controlled **simulated** W/J/service ledger; not measured hardware energy | Native scene/replay seam already exists, but values remain explicitly simulated | Principal beginner path | **KEEP AS MAIN**, subject to browser/novice gates |
| **Contiki-NG/Cooja/Energest** | High: Java, Gradle, source/submodule, Docker/display and platform differences; compile can be avoided only with a prebuilt fixture | Best direct state-based estimate; not electrical measurement; native motes and native sleep limits matter | No current Cooja input/output seam; requires provider adapter | Optional 15–25 minute evidence extension or specialist lab | **KEEP AS OPTIONAL** |
| **Wokwi** | Low: official docs describe an online browser simulator with no large download; supports Arduino/ESP32/STM32 and WiFi | Good for visible IoT behavior and packet/protocol traces; the official feature set does not provide a general MCU/radio energy ledger. A listed NeoPixel Meter is component-specific, not whole-node energy | No native Leo causal bridge; would be another disconnected simulator unless explicitly adapted | Simple optional IoT behavior demo, not energy authority | **OPTIONAL DEMO, NOT MAIN** |
| **SimPy** | Small Python dependency, no GUI/network stack; runs as fast as possible, real time, or step-by-step | Excellent for an explicit instructor-supplied power/time model; no radio or hardware semantics unless authored | Backend/workbook generator only; no meaningful 3D Leo causality by itself | Useful for a deterministic worksheet or hidden replay, not the student-facing tool | **USE AS BACKEND/PROTOTYPE, NOT MAIN** |

Wokwi's official documentation supports the low-setup claim and lists browser
simulation, WiFi, and logic-analyzer capabilities, but its ESP32 WiFi page
describes packet capture and simulation time rather than an energy accounting
model. See [Wokwi overview](https://docs.wokwi.com/) and [ESP32 WiFi
simulation](https://docs.wokwi.com/guides/esp32-wifi). SimPy's official
documentation describes a Python process-based discrete-event framework with
manual event stepping, which is useful for a transparent model but does not
provide a radio or power model by itself. See [SimPy
overview](https://simpy.readthedocs.io/en/latest/index.html).

## 6. Promotion gates for Cooja to become principal

Do not promote Cooja/Energest to the critical path unless all of these are
demonstrated in a fresh, instrumented rehearsal:

1. **Entry:** every machine reaches a prebuilt simulation and first meaningful
   action within five minutes; no student installs Docker/Java, clones source,
   or compiles the stack.
2. **Agency:** at least one learner choice changes the Cooja run, not only a
   Leo label or display.
3. **Common identity:** Leo scene, Cooja inputs, Energest output, service result,
   and export carry one trial/scenario identity.
4. **Energy evidence:** the state-to-current/voltage table is visible, units are
   explicit, and output is labelled estimated rather than measured.
5. **Fixed service:** payload, deadline/freshness, contact window, and boundary
   stay comparable across baseline, learner, and withheld runs.
6. **Depth:** two meaningful replays plus one explanation fit in 20 minutes for
   representative novices without instructor-written answers.
7. **Recovery:** a known-good .csc/container/trace restores a failed seat in
   two minutes and preserves the learner's workbook.
8. **Leo causality:** changing the learner policy changes the authoritative Leo
   evidence and the visible state through the same replay record; a Cooja panel
   or imported screenshot is not accepted as proof.

If any gate fails, keep Cooja optional and use the Leo-only deterministic path.

## Final recommendation

Use **Leo-only as the principal 120-minute beginner tool**, clearly labelled as
simulated teaching data. Add **Cooja/Energest as an optional, prebuilt evidence
lane** only after its state-time output can drive the same service/energy replay
contract. Use Wokwi for a low-friction IoT behavior demonstration or SimPy as a
hidden deterministic model, but do not mistake either for measured energy.

The objective conclusion is therefore:

> **Cooja/Energest should be KEEP-AS-OPTIONAL, not KEEP-AS-MAIN and not fully
> REJECTED. Its energy mechanism is educationally valid as a bounded estimate;
> its 120-minute beginner/classroom and Leo-integration risk is currently too
> high for the principal route.**
